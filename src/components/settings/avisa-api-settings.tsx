"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PhoneCall, Webhook, Zap, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AvisaStatus = {
  connected: boolean;
  loggedIn: boolean;
  jid: string | null;
};

export function AvisaApiSettings() {
  const [status, setStatus] = useState<AvisaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://agentecardoso258.app.n8n.cloud/webhook/avisa-whatsapp-ana");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/avisa/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setError("Não foi possível obter o estado da instância Avisa API.");
      }
    } catch {
      setError("Erro de rede ao contactar a Avisa API.");
    } finally {
      setLoading(false);
    }
  }

  async function saveWebhook() {
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/avisa/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await res.json();
        setError(d.error || "Erro ao guardar o webhook.");
      }
    } catch {
      setError("Erro de rede ao guardar o webhook.");
    }
  }

  const phone = status?.jid
    ? "+" + status.jid.split(":")[0].split("@")[0]
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">WhatsApp — Avisa API</h2>
        <p className="text-sm text-muted-foreground mt-1">
          O seu número está ligado via Avisa API Gateway. Não precisa da Meta Cloud API.
          A janela de 24 horas não se aplica — pode enviar mensagens a qualquer momento.
        </p>
      </div>

      {/* Estado da ligação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="h-4 w-4" />
            Estado da Ligação
          </CardTitle>
          <CardDescription>Estado atual do número WhatsApp na Avisa API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              A verificar…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}
          {status && !loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant={status.connected && status.loggedIn ? "success" : "destructive"}>
                  {status.connected && status.loggedIn ? "Conectado" : "Desconectado"}
                </Badge>
                {phone && (
                  <span className="text-sm font-mono text-foreground">{phone}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={status.connected ? "text-green-500" : "text-muted-foreground"}>●</span>
                  <span className="text-muted-foreground">Sessão WhatsApp:</span>
                  <span>{status.connected ? "Activa" : "Inactiva"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={status.loggedIn ? "text-green-500" : "text-muted-foreground"}>●</span>
                  <span className="text-muted-foreground">Login:</span>
                  <span>{status.loggedIn ? "Autenticado" : "Não autenticado"}</span>
                </div>
              </div>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={checkStatus} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
            Actualizar estado
          </Button>
        </CardContent>
      </Card>

      {/* Webhook */}
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
            <Button onClick={saveWebhook} disabled={!webhookUrl.startsWith("https://")}>
              Guardar Webhook
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                Guardado com sucesso
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vantagens Avisa API */}
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
              <span><strong className="text-foreground">Sem janela de 24 horas</strong> — os agentes podem responder a qualquer momento, sem restrições da Meta.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Sem templates obrigatórios</strong> — pode enviar mensagens personalizadas livremente para retomar conversas.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Ligação direta via QR Code</strong> — sem necessidade de aprovação ou conta Meta Business.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Sincronização em tempo real com o CRM</strong> — todas as mensagens dos agentes N8N aparecem automaticamente na Caixa de entrada e no Pipeline.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
