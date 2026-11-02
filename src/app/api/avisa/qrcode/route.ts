import { NextResponse } from "next/server";

const AVISA_TOKEN =
  process.env.AVISA_API_TOKEN ||
  "du0RvN9OZ9VJImoXQSspqclRC81Ff2eOZcs0UnrbXEv9eJcdLGWHyOMTy2qy";
const AVISA_URL = (
  process.env.AVISA_API_URL || "https://www.avisaapi.com.br/api"
).replace(/\/+$/, "");

export const dynamic = "force-dynamic";

// Caminhos possíveis para o QR Code na Avisa API (tenta em ordem)
const QR_PATHS = [
  "/instance/qr",
  "/instance/qrcode",
  "/instance/getQRCode",
  "/instance/base64qrcode",
  "/qrcode",
];

export async function GET() {
  const headers = {
    Authorization: `Bearer ${AVISA_TOKEN}`,
    "Content-Type": "application/json",
  };

  // Primeiro verifica se já está conectado
  try {
    const statusRes = await fetch(`${AVISA_URL}/instance/status`, {
      headers,
      cache: "no-store",
    });
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      const inner =
        (statusData?.data?.data as Record<string, unknown> | undefined) ??
        (statusData?.data as Record<string, unknown> | undefined) ??
        (statusData as Record<string, unknown>);
      const connected = Boolean(inner.Connected ?? inner.connected);
      const loggedIn = Boolean(inner.LoggedIn ?? inner.loggedIn);
      const jid: string | null =
        (inner.Jid as string | undefined) ??
        (inner.jid as string | undefined) ??
        null;

      if (connected && loggedIn) {
        return NextResponse.json({ connected: true, loggedIn: true, jid, qrcode: null });
      }
    }
  } catch {
    // Continua para tentar obter o QR mesmo que o status falhe
  }

  // Tenta obter o QR Code em cada caminho possível
  for (const path of QR_PATHS) {
    try {
      const res = await fetch(`${AVISA_URL}${path}`, {
        headers,
        cache: "no-store",
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type") ?? "";

        // Resposta é uma imagem PNG/JPEG diretamente
        if (contentType.startsWith("image/")) {
          const buffer = await res.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const mimeType = contentType.split(";")[0];
          return NextResponse.json({
            connected: false,
            loggedIn: false,
            jid: null,
            qrcode: `data:${mimeType};base64,${base64}`,
          });
        }

        // Resposta é JSON com campo de QR Code
        const data = await res.json();
        const inner =
          (data?.data?.data as Record<string, unknown> | undefined) ??
          (data?.data as Record<string, unknown> | undefined) ??
          (data as Record<string, unknown>);

        const qrcode: string | null =
          (inner.qrcode as string | undefined) ??
          (inner.QRCode as string | undefined) ??
          (inner.qr as string | undefined) ??
          (inner.base64 as string | undefined) ??
          (inner.image as string | undefined) ??
          null;

        if (qrcode) {
          const src = qrcode.startsWith("data:") ? qrcode : `data:image/png;base64,${qrcode}`;
          return NextResponse.json({
            connected: false,
            loggedIn: false,
            jid: null,
            qrcode: src,
          });
        }
      }
    } catch {
      // Tenta o próximo caminho
    }
  }

  // Nenhum caminho funcionou
  return NextResponse.json(
    { error: "Não foi possível obter o QR Code da Avisa API. Verifique o estado da instância." },
    { status: 503 }
  );
}
