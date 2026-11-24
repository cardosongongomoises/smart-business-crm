import { NextResponse } from "next/server";

const AVISA_TOKEN = process.env.AVISA_API_TOKEN;
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
  if (!AVISA_TOKEN) return NextResponse.json({ error: "Avisa API não configurada" }, { status: 503 });
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
