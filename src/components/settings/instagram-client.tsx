"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

/**
 * 023 — Conexión del canal de Instagram: la pantalla que faltaba.
 *
 * `PUT /api/settings/instagram` y el webhook existen desde la 014, pero el
 * canal solo se podía conectar llamando a la API a mano. Gemela de la de
 * Messenger y con las mismas reglas: se prueba contra la plataforma ANTES de
 * guardar, el token se cifra, hacia fuera solo se enseña su cola, y la
 * pantalla solo existe si el canal está encendido con `CHANNELS` (ADR-001).
 */

type Source = "zernio" | "meta";

type Connection = {
  source: Source;
  igUserId: string;
  accountRef: string | null;
  username: string | null;
  status: "connected" | "reconnect_required";
  tokenLast4: string;
};

type WebhookInfo = {
  instagramUrl: string | null;
  verifyToken: string;
  signatureLayer: boolean;
};

const HELP: Record<Source, { title: string; items: string[] }> = {
  zernio: {
    title: "Ligue a sua conta de Instagram ao Zernio e cole aqui a chave de API",
    items: [
      "A conta é ligada no painel do Zernio (Accounts → Connect), não aqui. Tem de ser uma conta profissional: empresarial ou de criador.",
      "A chave de API é criada em Zernio → Settings → API Keys e só é mostrada uma vez (começa por sk_).",
    ],
  },
  meta: {
    title: "Crie uma aplicação em developers.facebook.com com o produto Instagram",
    items: [
      "A conta tem de estar em modo profissional (Empresarial ou Criador).",
      "Gere o token com as permissões instagram_business_basic e instagram_business_manage_messages.",
      "Sem App Review, a conta só recebe mensagens de perfis com uma função na aplicação (administradores, programadores, testers).",
    ],
  },
};

export function InstagramClient() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<Source>("zernio");
  const [igUserId, setIgUserId] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  const refetch = useCallback(async () => {
    const [c, w] = await Promise.all([
      fetch("/api/settings/instagram").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/webhook").then((r) => (r.ok ? r.json() : null)),
    ]).catch(() => [null, null]);
    if (c) {
      setConnection(c.connection);
      if (c.connection) {
        setSource(c.connection.source);
        if (c.connection.source === "meta") setIgUserId(c.connection.igUserId);
      }
    }
    if (w) setWebhook(w);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function saveMeta() {
    setSaving(true);
    setError(null);
    setSaved(null);
    const res = await fetch("/api/settings/instagram", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "meta",
        igUserId: igUserId.trim(),
        token: token.trim(),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "Não foi possível ligar a conta");
      return;
    }
    const data = (await res.json()) as { username?: string | null };
    setToken("");
    setSaved(data.username ? `Conta ligada: @${data.username}` : "Ligação guardada");
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
  const canSaveMeta = token.trim().length > 0 && igUserId.trim().length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      {connection?.status === "reconnect_required" && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-soft bg-danger-tint p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-danger-text">
              {connection.source === "zernio"
                ? "A API key do Zernio expirou ou foi revogada."
                : "O token expirou ou foi revogado."}
            </p>
            <p className="text-danger-text opacity-80">
              Os envios pelo Instagram estão em pausa. Ligue novamente abaixo.
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
              {connection.username ? `: @${connection.username}` : ""}
            </p>
            <p className="text-success-text opacity-80">
              {connection.source === "zernio"
                ? `Conta ${connection.accountRef}`
                : `Conta ${connection.igUserId}`} {" "}
              · {connection.source === "zernio" ? "chave" : "token"} terminado em ····
              {connection.tokenLast4}
            </p>
          </div>
          <Badge variant="success">Instagram ativo</Badge>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {connection ? "Ligar novamente o Instagram" : "Ligar Instagram"}
          </CardTitle>
          <CardDescription>
            As mensagens directas da sua conta chegam à mesma caixa de entrada
            do WhatsApp, com a identificação do canal. {help.title}.
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
              endpoint="/api/settings/instagram"
              extraBody={{ source: "zernio" }}
              what="a sua conta de Instagram"
              idPrefix="ig"
              onSaved={() => void refetch()}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ig-user-id">ID da conta de Instagram</Label>
                  <Input
                    id="ig-user-id"
                    value={igUserId}
                    onChange={(e) => setIgUserId(e.target.value)}
                    placeholder="17841400000000000"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ig-token">Token de acesso</Label>
                  <Input
                    id="ig-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="IGAA…"
                    autoComplete="off"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {saved && <p className="text-sm text-success-text">{saved} ✓</p>}

              <Button disabled={saving || !canSaveMeta} onClick={() => void saveMeta()}>
                {saving ? "A testar…" : "Testar e guardar"}
              </Button>
            </>
          )}

          <p className="flex items-start gap-2 text-xs text-text-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            As mensagens directas entram na caixa de entrada; os comentários das suas
            publicações não. O Instagram não precisa de uma página do Facebook
            ligada: isso só é exigido pelo Messenger.
          </p>
        </CardContent>
      </Card>

      {source === "zernio" ? (
        <p className="flex items-start gap-2 text-xs text-text-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            O webhook é registado automaticamente no seu Zernio quando liga a
            conta e fica limitado às contas configuradas. Se deixar de receber
            mensagens, verifique{" "}
            <Link href="/settings/channels" className="font-semibold underline">
              o estado dos canais
            </Link>
            .
          </span>
        </p>
      ) : (
        webhook?.instagramUrl && (
          <Card>
            <CardHeader>
              <CardTitle>Webhook do Instagram</CardTitle>
              <CardDescription>
                Na sua aplicação Meta: Instagram → Definições → Webhooks. Objeto{" "}
                <code>instagram</code>, campo <code>messages</code>. Cole este
                URL e este token de verificação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>URL de retorno</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhook.instagramUrl} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copiar o URL"
                    onClick={() => void copy(webhook.instagramUrl!, "url")}
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
