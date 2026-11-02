"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZernioConnect } from "@/components/settings/zernio-connect";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * 017 — Conexión del canal de Messenger.
 *
 * Dos fuentes, como Instagram: la API unificada de Zernio o una app propia de
 * Meta. Misma forma que el wizard de WhatsApp: se prueba contra la plataforma
 * ANTES de guardar, el token se cifra y hacia fuera solo se enseña su cola. Y
 * la misma regla que los demás canales: la pantalla solo existe si el canal
 * está encendido con `CHANNELS` (ADR-001).
 */

type Source = "zernio" | "meta";

type Connection = {
  source: Source;
  pageId: string | null;
  pageName: string | null;
  accountRef: string | null;
  status: "connected" | "reconnect_required";
  tokenLast4: string;
};

type WebhookInfo = {
  messengerUrl: string | null;
  verifyToken: string;
  isHttps: boolean;
  signatureLayer: boolean;
};

const HELP: Record<Source, { title: string; items: string[] }> = {
  zernio: {
    title: "Ligue a sua página no Zernio e cole aqui a sua API key",
    items: [
      "A página é ligada no painel do Zernio (Accounts → Connect), não aqui.",
      "A API key é criada em Zernio → Settings → API Keys e só é mostrada uma vez (começa por sk_).",
    ],
  },
  meta: {
    title: "Crie uma aplicação em developers.facebook.com com o produto Messenger",
    items: [
      "O ID da página está na secção «Informações» da página, ou em Messenger → Definições → Tokens de acesso.",
      "Gere aí o token da página com a permissão pages_messaging. Um token de longa duração evita ligar novamente a cada dois meses.",
      "Sem App Review, a página só recebe mensagens de contas com uma função na aplicação (administradores, programadores, testers).",
    ],
  },
};

export function MessengerClient() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<Source>("zernio");
  const [pageId, setPageId] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  const refetch = useCallback(async () => {
    const [c, w] = await Promise.all([
      fetch("/api/settings/messenger").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/webhook").then((r) => (r.ok ? r.json() : null)),
    ]).catch(() => [null, null]);
    if (c) {
      setConnection(c.connection);
      if (c.connection) {
        setSource(c.connection.source);
        if (c.connection.pageId) setPageId(c.connection.pageId);
      }
    }
    if (w) setWebhook(w);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /** Fuente Meta. Con Zernio guarda `ZernioConnect` (023). */
  async function save() {
    setSaving(true);
    setError(null);
    setSaved(null);
    const res = await fetch("/api/settings/messenger", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "meta",
        pageId: pageId.trim() || null,
        token: token.trim(),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "Não foi possível ligar a página");
      return;
    }
    const data = (await res.json()) as { pageName?: string | null };
    setToken("");
    setSaved(data.pageName ? `Página ligada: ${data.pageName}` : "Ligação guardada");
    void refetch();
  }

  async function copy(text: string, what: "url" | "token") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // sin portapapeles (contexto no seguro): el texto sigue visible
    }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">A carregar…</p>;

  const help = HELP[source];
  const canSave = token.trim().length > 0 && pageId.trim().length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      {connection?.status === "reconnect_required" && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-soft bg-danger-tint p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-danger-text">
              O token expirou ou foi revogado.
            </p>
            <p className="text-danger-text opacity-80">
              Os envios pelo Messenger estão em pausa. Cole um novo abaixo para
              ligar novamente.
            </p>
          </div>
        </div>
      )}

      {connection?.status === "connected" && (
        <div className="flex items-center gap-3 rounded-lg border border-success-soft bg-success-tint p-4">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-success-text">
              Ligado por {connection.source === "zernio" ? "Zernio" : "Meta"}
              {connection.pageName ? `: ${connection.pageName}` : ""}
            </p>
            <p className="text-success-text opacity-80">
              {connection.source === "zernio"
                ? `Conta ${connection.accountRef}`
                : `Página ${connection.pageId}`} {" "}
              · token terminado em ····{connection.tokenLast4}
            </p>
          </div>
          <Badge variant="success">Messenger ativo</Badge>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {connection ? "Ligar novamente o Messenger" : "Ligar Messenger"}
          </CardTitle>
          <CardDescription>
            As mensagens que as pessoas escrevem para a sua página entram na mesma
            caixa de entrada do WhatsApp, com a sua identificação de canal. {help.title}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>De onde chegam as mensagens?</Label>
            <div className="flex flex-wrap gap-2">
              {(["zernio", "meta"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  aria-pressed={source === s}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                    source === s
                      ? "border-brand bg-brand-tint text-brand-text"
                      : "border-border-strong hover:bg-accent"
                  )}
                >
                  {s === "zernio" ? "Zernio (API unificada)" : "Aplicação própria da Meta"}
                </button>
              ))}
            </div>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-text-2">
            {help.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          {source === "zernio" ? (
            <ZernioConnect
              endpoint="/api/settings/messenger"
              extraBody={{ source: "zernio" }}
              what="a sua página do Facebook"
              idPrefix="fb"
              onSaved={() => void refetch()}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fb-page-id">ID da página</Label>
                  <Input
                    id="fb-page-id"
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="1234567890"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fb-token">Token da página</Label>
                  <Input
                    id="fb-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="EAAG…"
                    autoComplete="off"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {saved && <p className="text-sm text-success-text">{saved} ✓</p>}

              <Button disabled={saving || !canSave} onClick={() => void save()}>
                {saving ? "A testar…" : "Testar e guardar"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {source === "zernio" ? (
        <p className="flex items-start gap-2 text-xs text-text-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            O webhook é registado automaticamente no seu Zernio quando liga a
            página e fica limitado às contas configuradas. Se deixar de receber
            mensagens, verifique{" "}
            <Link href="/settings/channels" className="font-semibold underline">
              o estado dos canais
            </Link>
            .
          </span>
        </p>
      ) : (
        webhook?.messengerUrl && (
          <Card>
            <CardHeader>
              <CardTitle>Webhook do Messenger</CardTitle>
              <CardDescription>
                Na sua aplicação Meta: Messenger → Definições → Webhooks. Objeto{" "}
                <code>page</code>, campo <code>messages</code>. Cole este URL e
                este token de verificação e subscreva a página à aplicação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>URL de retorno</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhook.messengerUrl} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copiar o URL"
                    onClick={() => void copy(webhook.messengerUrl!, "url")}
                  >
                    {copied === "url" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Token de verificação</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhook.verifyToken} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copiar o token de verificação"
                    onClick={() => void copy(webhook.verifyToken, "token")}
                  >
                    {copied === "token" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="flex items-start gap-2 text-xs text-text-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {webhook.signatureLayer
                  ? "Cada entrega é verificada com a assinatura do App Secret da sua aplicação."
                  : "Defina META_APP_SECRET na instância para verificar também a assinatura de cada entrega."}
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
