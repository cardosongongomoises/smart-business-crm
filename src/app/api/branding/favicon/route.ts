import { readMediaFile } from "@/server/whatsapp/media";
import { getBrandingContext, getFaviconBuffer } from "@/server/branding";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { FAVICON_ASSET, generatedFaviconSvg } from "@/lib/favicon";

export const dynamic = "force-dynamic";

/**
 * Cabeceras con las que se sirve CUALQUIER icono, subido o generado.
 */
function cabeceras(mime: string, cacheable: boolean): HeadersInit {
  return {
    "content-type": mime,
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    "x-content-type-options": "nosniff",
    "cache-control": cacheable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=60",
  };
}

/**
 * O ícone da marca / separador. Rota pública.
 */
export async function GET(req: Request) {
  const cacheable = new URL(req.url).searchParams.has("v");

  const ctx = await getBrandingContext().catch(() => null);
  const branding = ctx?.branding ?? DEFAULT_BRANDING;

  if (ctx?.organizationId && branding.favicon) {
    // 1. Tentar ler do banco de dados (persistência do Supabase)
    try {
      const fav = await getFaviconBuffer(ctx.organizationId);
      if (fav?.data) {
        return new Response(new Uint8Array(fav.data), {
          headers: cabeceras(fav.mime, cacheable),
        });
      }
    } catch {
      // continua para o disco se falhar
    }

    // 2. Tentar ler do disco / storage
    try {
      const buf = await readMediaFile(ctx.organizationId, FAVICON_ASSET);
      return new Response(new Uint8Array(buf), {
        headers: cabeceras(branding.favicon.mime, cacheable),
      });
    } catch {
      // El archivo se perdió
    }
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const buf = await fs.readFile(path.join(process.cwd(), "public", "favicon-32x32.png"));
    return new Response(new Uint8Array(buf), {
      headers: cabeceras("image/png", cacheable),
    });
  } catch {
    return new Response(generatedFaviconSvg(branding), {
      headers: cabeceras("image/svg+xml", cacheable),
    });
  }
}
