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

    // A Avisa API retorna: { status: true, data: { code: 200, data: { Connected, LoggedIn, Jid } } }
    // Navegamos pelas camadas aninhadas
    const rawData = data as Record<string, unknown> | null;
    const l1 = (rawData?.data as Record<string, unknown> | null) ?? rawData;
    const inner = (l1?.data as Record<string, unknown> | null) ?? l1 ?? {};

    const rawConnected = inner.Connected ?? inner.connected;
    const connected = typeof rawConnected === "boolean" ? rawConnected : inner.status === "connected";

    const rawLoggedIn = inner.LoggedIn ?? inner.loggedIn;
    const loggedIn = typeof rawLoggedIn === "boolean" ? rawLoggedIn : Boolean(inner.authenticated);

    const jid: string | null =
      (typeof inner.Jid === "string" ? inner.Jid : null) ??
      (typeof inner.jid === "string" ? inner.jid : null) ??
      (typeof inner.phone === "string" ? inner.phone : null);

    return NextResponse.json({ connected, loggedIn, jid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
