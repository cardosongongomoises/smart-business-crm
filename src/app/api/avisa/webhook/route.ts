import { NextResponse } from "next/server";

const AVISA_TOKEN = process.env.AVISA_API_TOKEN;
const AVISA_URL = (
  process.env.AVISA_API_URL || "https://www.avisaapi.com.br/api"
).replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!AVISA_TOKEN) return NextResponse.json({ error: "Avisa API não configurada" }, { status: 503 });
  try {
    const body = (await req.json()) as { url?: string } | null;
    const url = body?.url;
    if (!url || typeof url !== "string" || !url.startsWith("https://")) {
      return NextResponse.json(
        { error: "URL inválida. O webhook deve usar HTTPS." },
        { status: 400 }
      );
    }

    const res = await fetch(`${AVISA_URL}/instance/webhook`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AVISA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ webhook: url }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Avisa API respondeu com erro: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
