import { NextResponse } from "next/server";

const AVISA_TOKEN =
  process.env.AVISA_API_TOKEN ||
  "du0RvN9OZ9VJImoXQSspqclRC81Ff2eOZcs0UnrbXEv9eJcdLGWHyOMTy2qy";
const AVISA_URL = (
  process.env.AVISA_API_URL || "https://www.avisaapi.com.br/api"
).replace(/\/+$/, "");

export const dynamic = "force-dynamic";

const DISCONNECT_PATHS = [
  "/instance/disconnect",
  "/instance/logout",
  "/instance/close",
];

export async function POST() {
  const headers = {
    Authorization: `Bearer ${AVISA_TOKEN}`,
    "Content-Type": "application/json",
  };

  for (const path of DISCONNECT_PATHS) {
    try {
      const res = await fetch(`${AVISA_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (res.ok) {
        return NextResponse.json({ success: true, message: "WhatsApp desconectado com sucesso." });
      }
    } catch {
      // Tenta o próximo caminho
    }
  }

  return NextResponse.json(
    { error: "Não foi possível desconectar. Tente novamente." },
    { status: 503 }
  );
}
