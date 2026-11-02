import { NextResponse } from "next/server";

const AVISA_TOKEN =
  process.env.AVISA_API_TOKEN ||
  "du0RvN9OZ9VJImoXQSspqclRC81Ff2eOZcs0UnrbXEv9eJcdLGWHyOMTy2qy";
const AVISA_URL = (
  process.env.AVISA_API_URL || "https://www.avisaapi.com.br/api"
).replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${AVISA_URL}/instance/status`, {
      headers: {
        Authorization: `Bearer ${AVISA_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Avisa API respondeu com erro: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Normalizar os campos da resposta da Avisa API
    const connected: boolean =
      data.connected ?? data.Connected ?? data.status === "connected" ?? false;
    const loggedIn: boolean =
      data.loggedIn ?? data.LoggedIn ?? data.authenticated ?? false;
    const jid: string | null =
      data.jid ?? data.Jid ?? data.phone ?? null;

    return NextResponse.json({ connected, loggedIn, jid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
