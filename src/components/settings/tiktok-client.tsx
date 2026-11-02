"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ZernioConnect } from "@/components/settings/zernio-connect";

/**
 * 022 — Conexión del canal de TikTok.
 *
 * Una sola fuente: Zernio (TikTok no entrega mensajes a una app propia). Misma
 * forma que los demás canales: la llave se prueba contra la plataforma ANTES
 * de guardar, se cifra, y hacia fuera solo se enseña su cola. La pantalla solo
 * existe si el canal está encendido con `CHANNELS` (ADR-001).
 *
 * TikTok impone reglas que ningún otro canal tiene. Se dicen aquí, antes de
 * conectar, para que nadie las descubra con un mensaje rechazado.
 */

type Connection = {
  accountRef: string;
  username: string | null;
  status: "connected" | "reconnect_required";
  tokenLast4: string;
  hasWebhookSecret: boolean;
};

const PASOS = [
  "A conta é ligada no painel do Zernio (Contas → Ligar), não aqui.",
  "A chave da API é criada em Zernio → Definições → Chaves de API e só é mostrada uma vez (começa por sk_).",
];

const REGLAS = [
  "A conta tem de ser TikTok Business, registada fora da União Europeia, Suíça e Reino Unido, e com as mensagens directas abertas.",
  "Não é possível iniciar uma conversa: só pode responder a quem lhe escreveu.",
  "Depois da última mensagem do cliente, pode enviar até 10 mensagens durante 48 horas. Para continuar, o cliente tem de voltar a escrever.",
  "Cada mensagem é apenas texto e pode ter até 6 000 caracteres. Ainda não é possível enviar imagens por aqui.",
];

export function TiktokClient() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const c = await fetch("/api/settings/tiktok")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (c) setConnection(c.connection);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  if (!loaded) return <p className="text-sm text-muted-foreground">A carregar…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      {connection?.status === "reconnect_required" && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-soft bg-danger-tint p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-danger-text">
              A API key do Zernio expirou ou foi revogada.
            </p>
            <p className="text-danger-text opacity-80">
              Os envios pelo TikTok estão pausados. Introduza uma nova chave abaixo
              para ligar novamente.
            </p>
          </div>
        </div>
      )}

      {connection?.status === "connected" && (
        <div className="flex items-center gap-3 rounded-lg border border-success-soft bg-success-tint p-4">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-success-text">
              Ligado pelo Zernio
              {connection.username ? `: @${connection.username}` : ""}
            </p>
            <p className="text-success-text opacity-80">
              Conta {connection.accountRef} · chave que termina em ····
              {connection.tokenLast4}
              {connection.hasWebhookSecret ? " · assinatura do webhook ativa" : ""}
            </p>
          </div>
          <Badge variant="success">TikTok ativo</Badge>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Antes de ligar: requisitos do TikTok</CardTitle>
          <CardDescription>
            Não são limites deste CRM: são impostos pelo TikTok às mensagens directas
            de uma conta empresarial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-text-2">
            {REGLAS.map((regla, i) => (
              <li key={i}>{regla}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{connection ? "Ligar novamente o TikTok" : "Ligar TikTok"}</CardTitle>
          <CardDescription>
            As mensagens directas da sua conta aparecem na mesma Caixa de entrada
            do WhatsApp, com a respetiva identificação de canal. São entregues pelo
            Zernio, através da sua própria conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-xs text-text-2">
            {PASOS.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          <ZernioConnect
            endpoint="/api/settings/tiktok"
            what="a sua conta do TikTok"
            idPrefix="tt"
            onSaved={() => void refetch()}
          />
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs text-text-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          O AGENTES DIGITAL regista automaticamente o webhook na sua conta do
          Zernio ao ligar, limitado às suas contas. Se deixar de receber mensagens,
          consulte{" "}
          <Link href="/settings/channels" className="font-semibold underline">
            o estado dos canais
          </Link>
          .
        </span>
      </p>
    </div>
  );
}
