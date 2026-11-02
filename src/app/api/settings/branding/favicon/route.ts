import { apiError, withAuth } from "@/lib/api";
import {
  FAVICON_ASSET,
  MAX_FAVICON_BYTES,
  sniffFaviconMime,
} from "@/lib/favicon";
import { clearFaviconData, saveFaviconData } from "@/server/branding";
import { deleteMediaFile, saveMediaFile } from "@/server/whatsapp/media";

export const dynamic = "force-dynamic";

/**
 * Subir o ícone da marca / separador.
 * Guarda no metadata da organização (persistência no PostgreSQL / Supabase)
 * e opcionalmente no disco / bucket.
 */
export const PUT = withAuth(async (session, req: Request) => {
  if (session.role !== "owner") {
    return apiError(403, "forbidden", "Apenas o proprietário pode alterar a marca");
  }

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return apiError(422, "empty", "Não foi enviado nenhum ficheiro");
  }
  if (buf.byteLength > MAX_FAVICON_BYTES) {
    return apiError(
      413,
      "too_large",
      `O ícone não pode ultrapassar ${Math.round(MAX_FAVICON_BYTES / 1024)} KB`
    );
  }

  const mime = sniffFaviconMime(buf);
  if (!mime) {
    return apiError(
      422,
      "unsupported",
      "Formato não reconhecido. Use PNG, SVG, ICO, JPEG ou WebP."
    );
  }

  const version = Date.now();

  // 1. Guardar de forma garantida no banco de dados
  await saveFaviconData(session.organizationId, buf, mime, version);

  // 2. Tentar guardar no disco/storage (sem quebrar a requisição se falhar em ambiente serverless)
  try {
    await saveMediaFile(session.organizationId, FAVICON_ASSET, buf, mime);
  } catch (err) {
    console.warn("[favicon] Aviso: armazenamento em disco ignorado (serverless):", err);
  }

  return Response.json({ favicon: { mime, version } });
});

/** Quitar el subido y volver al generado de la marca. */
export const DELETE = withAuth(async (session) => {
  if (session.role !== "owner") {
    return apiError(403, "forbidden", "Apenas o proprietário pode alterar a marca");
  }

  await clearFaviconData(session.organizationId);
  await deleteMediaFile(session.organizationId, FAVICON_ASSET).catch(() => null);

  return Response.json({ favicon: null });
});
