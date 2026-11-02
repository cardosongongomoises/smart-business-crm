import { NextResponse } from "next/server";

const AVISA_TOKEN =
  process.env.AVISA_API_TOKEN ||
  "du0RvN9OZ9VJImoXQSspqclRC81Ff2eOZcs0UnrbXEv9eJcdLGWHyOMTy2qy";
const AVISA_URL = (
  process.env.AVISA_API_URL || "https://www.avisaapi.com.br/api"
).replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || !url.startsWith("https://")) {
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
