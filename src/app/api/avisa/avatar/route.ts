import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { like } from "drizzle-orm";
import { upsertFicha } from "@/server/bot/ficha";

const AVISA_TOKEN =
  process.env.AVISA_API_TOKEN ||
  "du0RvN9OZ9VJImoXQSspqclRC81Ff2eOZcs0UnrbXEv9eJcdLGWHyOMTy2qy";
const AVISA_URL = (
  process.env.AVISA_API_URL || "https://www.avisaapi.com.br/api"
).replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPhone = searchParams.get("phone") || searchParams.get("number") || "";
    const clean = rawPhone.replace(/\D/g, "");

    if (!clean || clean.length < 8) {
      return NextResponse.json({ error: "Número inválido" }, { status: 400 });
    }

    const res = await fetch(`${AVISA_URL}/user/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AVISA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ number: clean, preview: false }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ url: null });
    }

    const json = (await res.json()) as Record<string, unknown> | null;
    const l1 = (json?.data as Record<string, unknown> | null) ?? json;
    const inner = (l1?.data as Record<string, unknown> | null) ?? l1;
    const url: string | null =
      (typeof inner?.url === "string" ? inner.url : null) ??
      (typeof l1?.url === "string" ? l1.url : null);

    if (url) {
      // Atualizar no banco de dados através da porta única upsertFicha
      try {
        const db = getDb();
        const lastDigits = clean.slice(-9);
        const contacts = await db
          .select()
          .from(schema.contact)
          .where(like(schema.contact.phone, `%${lastDigits}`))
          .limit(5);

        for (const c of contacts) {
          const ficha = (c.ficha as Record<string, unknown> | null) ?? {};
          if (ficha.avatarUrl !== url) {
            await upsertFicha({
              organizationId: c.organizationId,
              contactId: c.id,
              ficha: { avatarUrl: url },
            });
          }
        }
      } catch {
        // Silêncio em erros secundários de persistência
      }
    }

    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
