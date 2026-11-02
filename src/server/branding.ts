import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  DEFAULT_BRANDING,
  normalizeBranding,
  type Branding,
} from "@/lib/branding";

/** Marca guardada en organization.metadata (JSON de Better Auth). */

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Marca + a qué organización pertenece.
 *
 * El icono se guarda como archivo en `MEDIA_DIR/{organizationId}/favicon`, así
 * que servirlo necesita el id — y la ruta que lo sirve es pública (el login
 * también tiene pestaña), donde no hay sesión de la que sacarlo.
 */
export async function getBrandingContext(
  organizationId?: string | null
): Promise<{ organizationId: string | null; branding: Branding }> {
  const db = getDb();
  const rows = organizationId
    ? await db
        .select({ id: schema.organization.id, metadata: schema.organization.metadata })
        .from(schema.organization)
        .where(eq(schema.organization.id, organizationId))
        .limit(1)
    : // Sin sesión (login, layout raíz): la única organización de la instancia.
      await db
        .select({ id: schema.organization.id, metadata: schema.organization.metadata })
        .from(schema.organization)
        .limit(1);
  if (!rows[0]) return { organizationId: null, branding: DEFAULT_BRANDING };
  const meta = parseMetadata(rows[0].metadata);
  return {
    organizationId: rows[0].id,
    branding: normalizeBranding(
      (meta.branding as Partial<Branding> | undefined) ?? null
    ),
  };
}

export async function getBranding(
  organizationId?: string | null
): Promise<Branding> {
  return (await getBrandingContext(organizationId)).branding;
}

export async function saveBranding(
  organizationId: string,
  branding: Branding
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  const meta = parseMetadata(rows[0]?.metadata ?? null);
  meta.branding = normalizeBranding(branding);
  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(meta) })
    .where(eq(schema.organization.id, organizationId));
}

export async function getFaviconBuffer(
  organizationId?: string | null
): Promise<{ data: Buffer; mime: string } | null> {
  const db = getDb();
  const rows = organizationId
    ? await db
        .select({ metadata: schema.organization.metadata })
        .from(schema.organization)
        .where(eq(schema.organization.id, organizationId))
        .limit(1)
    : await db
        .select({ metadata: schema.organization.metadata })
        .from(schema.organization)
        .limit(1);
  if (!rows[0]) return null;
  const meta = parseMetadata(rows[0].metadata);
  const favData = meta.faviconData as { data?: string; mime?: string } | undefined;
  if (favData?.data && favData?.mime) {
    return {
      data: Buffer.from(favData.data, "base64"),
      mime: favData.mime,
    };
  }
  return null;
}

export async function saveFaviconData(
  organizationId: string,
  buffer: Uint8Array,
  mime: string,
  version: number
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  const meta = parseMetadata(rows[0]?.metadata ?? null);
  const base64 = Buffer.from(buffer).toString("base64");
  meta.faviconData = { data: base64, mime, version };
  const currentBranding = normalizeBranding(
    (meta.branding as Partial<Branding> | undefined) ?? null
  );
  meta.branding = {
    ...currentBranding,
    favicon: { mime, version },
  };
  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(meta) })
    .where(eq(schema.organization.id, organizationId));
}

export async function clearFaviconData(organizationId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  const meta = parseMetadata(rows[0]?.metadata ?? null);
  delete meta.faviconData;
  const currentBranding = normalizeBranding(
    (meta.branding as Partial<Branding> | undefined) ?? null
  );
  meta.branding = {
    ...currentBranding,
    favicon: null,
  };
  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(meta) })
    .where(eq(schema.organization.id, organizationId));
}
