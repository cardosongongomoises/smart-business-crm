"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PhoneCall,
  QrCode,
  Smartphone,
  Unplug,
  Webhook,
  Zap,
} from "lucide-react";
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

// ─── Tipos ──────────────────────────────────────────────────────────────────

type AvisaStatus = {
  connected: boolean;
  loggedIn: boolean;
  jid: string | null;
};

type QrState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "qr"; src: string; expiresAt: number }
  | { phase: "connected"; jid: string | null }
  | { phase: "error"; message: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function phoneFromJid(jid: string | null): string | null {
  if (!jid) return null;
  const parts = jid.split(":");
  const firstPart = parts[0] ?? jid;
  const atParts = firstPart.split("@");
  const phoneNum = atParts[0] ?? firstPart;
  return "+" + phoneNum;
}

// QR codes da Avisa API expiram — mostramos um countdown e pedimos refresh automático
const QR_TTL_MS = 20_000; // 20 segundos
const POLL_CONNECTED_MS = 3_000; // verifica ligação a cada 3 s enquanto o QR está visível

// ─── Componente Principal ────────────────────────────────────────────────────

export function AvisaApiSettings() {
  const [status, setStatus] = useState<AvisaStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [qr, setQr] = useState<QrState>({ phase: "idle" });
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [webhookUrl, setWebhookUrl] = useState(
    "https://agentecardoso258.app.n8n.cloud/webhook/avisa-whatsapp-ana"
  );
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  const [disconnecting, setDisconnecting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Status ──────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/avisa/status");
      if (res.ok) {
        const data: AvisaStatus = await res.json();
        setStatus(data);
        return data;
      }
    } catch {
      // silencia
    } finally {
      setLoadingStatus(false);
    }
    return null;
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // ── QR Code ─────────────────────────────────────────────────────────────

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    pollRef.current = null;
    countdownRef.current = null;
  }

  const loadQr = useCallback(async () => {
    setQr({ phase: "loading" });
    try {
      const res = await fetch("/api/avisa/qrcode");
      const data = await res.json() as {
        connected?: boolean;
        loggedIn?: boolean;
        jid?: string | null;
        qrcode?: string | null;
        error?: string;
      };

      if (!res.ok || data.error) {
        setQr({ phase: "error", message: data.error ?? "Erro ao obter QR Code." });
        return;
      }

      if (data.connected && data.loggedIn) {
        setQr({ phase: "connected", jid: data.jid ?? null });
        setStatus({ connected: true, loggedIn: true, jid: data.jid ?? null });
        stopPolling();
        return;
      }

      if (data.qrcode) {
        const expiresAt = Date.now() + QR_TTL_MS;
        setQr({ phase: "qr", src: data.qrcode, expiresAt });
        setSecondsLeft(Math.round(QR_TTL_MS / 1000));

        // Countdown visual
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setSecondsLeft((s) => {
            if (s <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              return 0;
            }
            return s - 1;
          });
        }, 1000);

        // Polling: verifica ligação
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          const s = await fetchStatus();
          if (s?.connected && s?.loggedIn) {
            setQr({ phase: "connected", jid: s.jid });
            stopPolling();
          }
        }, POLL_CONNECTED_MS);

        // Auto-renova o QR quando expira
        setTimeout(() => {
          setQr((prev) => {
            if (prev.phase === "qr") {
              void loadQr();
            }
            return prev;
          });
        }, QR_TTL_MS);

        return;
      }

      setQr({
        phase: "error",
        message: "A Avisa API não retornou um QR Code. A instância pode já estar conectada.",
      });
    } catch {
      setQr({ phase: "error", message: "Erro de rede ao obter QR Code." });
    }
  }, [fetchStatus]);

  useEffect(() => () => stopPolling(), []);

  // ── Desconectar ──────────────────────────────────────────────────────────

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/avisa/disconnect", { method: "POST" });
      if (res.ok) {
        setStatus({ connected: false, loggedIn: false, jid: null });
        setQr({ phase: "idle" });
      }
    } catch {
      // silencia
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Webhook ──────────────────────────────────────────────────────────────

  async function saveWebhook() {
    setSavingWebhook(true);
    setWebhookError(null);
    try {
      const res = await fetch("/api/avisa/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      if (res.ok) {
        setWebhookSaved(true);
        setTimeout(() => setWebhookSaved(false), 3000);
      } else {
        const d = await res.json() as { error?: string };
        setWebhookError(d.error ?? "Erro ao guardar o webhook.");
      }
    } catch {
      setWebhookError("Erro de rede ao guardar o webhook.");
    } finally {
      setSavingWebhook(false);
    }
  }

  const phone = phoneFromJid(status?.jid ?? null);
  const isConnected = status?.connected && status?.loggedIn;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">WhatsApp — Avisa API</h2>
        <p className="text-sm text-muted-foreground mt-1">
          O seu número está ligado via Avisa API Gateway. Sem Meta Cloud API, sem janela
          de 24 horas, sem templates obrigatórios.
        </p>
      </div>

      {/* ── Ligação / QR Code ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="h-4 w-4" />
            Ligação WhatsApp
          </CardTitle>
          <CardDescription>
            {isConnected
              ? "O seu WhatsApp está ligado e a funcionar."
              : "Ligue o seu WhatsApp lendo o QR Code abaixo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Estado atual */}
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              A verificar estado…
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={isConnected ? "success" : "destructive"}>
                {isConnected ? "Conectado" : "Desconectado"}
              </Badge>
              {phone && (
                <span className="text-sm font-mono text-foreground">{phone}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void fetchStatus()}
                disabled={loadingStatus}
              >
                Actualizar
              </Button>
            </div>
          )}

          {/* Acções */}
          {isConnected ? (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                {disconnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <Unplug className="h-3.5 w-3.5 mr-2" />
                )}
                Desligar WhatsApp
              </Button>
              <p className="text-xs text-muted-foreground">
                Ao desligar, um novo QR Code será gerado para ligar outro número.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* QR Code display */}
              {qr.phase === "idle" && (
                <Button onClick={() => void loadQr()}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Gerar QR Code
                </Button>
              )}

              {qr.phase === "loading" && (
                <div className="flex items-center gap-3 text-muted-foreground text-sm">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  A gerar QR Code…
                </div>
              )}

              {qr.phase === "error" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{qr.message}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void loadQr()}>
                    Tentar novamente
                  </Button>
                </div>
              )}

              {qr.phase === "qr" && (
                <div className="space-y-4">
                  {/* QR Image */}
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qr.src}
                      alt="QR Code WhatsApp"
                      className="w-52 h-52 rounded-xl border-4 border-white shadow-lg"
                    />
                    {secondsLeft <= 5 && secondsLeft > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                        <span className="text-white text-3xl font-bold">{secondsLeft}</span>
                      </div>
                    )}
                  </div>

                  {/* Countdown */}
                  <p className="text-xs text-muted-foreground">
                    O QR Code renova automaticamente em{" "}
                    <span className="font-semibold text-foreground">{secondsLeft}s</span>
                  </p>

                  {/* Instruções */}
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Como ligar o WhatsApp:
                    </p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Abra o WhatsApp no telemóvel</li>
                      <li>
                        Toque em <span className="font-medium text-foreground">⋮</span> →{" "}
                        <span className="font-medium text-foreground">Dispositivos ligados</span> →{" "}
                        <span className="font-medium text-foreground">Ligar um dispositivo</span>
                      </li>
                      <li>Aponte a câmara para o QR Code acima</li>
                    </ol>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    A aguardar ligação…
                  </div>
                </div>
              )}

              {qr.phase === "connected" && (
                <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  WhatsApp ligado com sucesso!{" "}
                  {qr.jid && (
                    <span className="font-mono text-foreground">
                      {phoneFromJid(qr.jid)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Webhook N8N ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" />
            Webhook N8N
          </CardTitle>
          <CardDescription>
            URL para onde a Avisa API envia as mensagens recebidas dos clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL do Webhook</Label>
            <Input
              id="webhook-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Este URL recebe as mensagens dos clientes e aciona os agentes de IA no N8N.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => void saveWebhook()}
              disabled={savingWebhook || !webhookUrl.startsWith("https://")}
            >
              {savingWebhook && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
              Guardar Webhook
            </Button>
            {webhookSaved && (
              <span className="flex items-center gap-1 text-sm text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                Guardado com sucesso
              </span>
            )}
            {webhookError && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {webhookError}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Vantagens ── */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-yellow-500" />
            Vantagens do modo Avisa API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Sem janela de 24 horas</strong> — os
                agentes podem responder a qualquer momento, sem restrições da Meta.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Sem templates obrigatórios</strong> —
                pode enviar mensagens personalizadas livremente para retomar conversas.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Ligação por QR Code</strong> — basta
                apontar o telemóvel, sem necessidade de conta Meta Business ou aprovações.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">
                  Sincronização em tempo real com o CRM
                </strong>{" "}
                — todas as mensagens dos agentes N8N aparecem automaticamente na Caixa de
                entrada e no Pipeline.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
