"use client";

import { useEffect, useState } from "react";
import { Send, FileText } from "lucide-react";
import type { TemplateDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Cuenta {{1}}..{{n}} igual que el servidor, para pedir sus valores. */
function countVariables(body: string): number {
  const found = new Set(
    Array.from(body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)).map((m) => m[1])
  );
  return found.size;
}

export function StartConversation({
  contactId,
  onStarted,
}: {
  contactId: string;
  onStarted: (conversationId: string) => void;
}) {
  const [directMessage, setDirectMessage] = useState("");
  const [templates, setTemplates] = useState<TemplateDto[] | null>(null);
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/templates").catch(() => null);
      if (!res?.ok) return setTemplates([]);
      const data = (await res.json()) as { templates: TemplateDto[] };
      const aprobadas = data.templates.filter((t) => t.status === "approved");
      setTemplates(aprobadas);
      if (aprobadas.length > 0) {
        setTemplateId(aprobadas[0]?.id ?? "");
      }
    })();
  }, []);

  const elegida = templates?.find((t) => t.id === templateId) ?? null;
  const nVars = elegida ? countVariables(elegida.body) : 0;

  async function enviarDireto() {
    if (!directMessage.trim()) return;
    setEnviando(true);
    setError(null);
    const res = await fetch(`/api/contacts/${contactId}/start-conversation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: directMessage.trim() }),
    }).catch(() => null);
    setEnviando(false);
    const data = (await res?.json().catch(() => null)) as
      | { error?: { message?: string }; conversationId?: string }
      | null;
    if (!res?.ok) {
      setError(data?.error?.message ?? "Não foi possível enviar a mensagem");
      return;
    }
    onStarted(data?.conversationId ?? "");
  }

  async function enviarModelo() {
    setEnviando(true);
    setError(null);
    const res = await fetch(`/api/contacts/${contactId}/start-conversation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateId,
        variables: nVars > 0 ? vars.slice(0, nVars) : undefined,
      }),
    }).catch(() => null);
    setEnviando(false);
    const data = (await res?.json().catch(() => null)) as
      | { error?: { message?: string }; conversationId?: string }
      | null;
    if (!res?.ok) {
      setError(data?.error?.message ?? "Não foi possível iniciar a conversa com o modelo");
      return;
    }
    onStarted(data?.conversationId ?? "");
  }

  return (
    <div className="space-y-3">
      {!useTemplate ? (
        <div className="space-y-3">
          <p className="text-xs text-text-3">
            Escreva a mensagem para enviar diretamente ao contacto via WhatsApp (sem restrições de modelos):
          </p>
          <textarea
            value={directMessage}
            onChange={(e) => setDirectMessage(e.target.value)}
            placeholder="Olá! Como posso ajudar a sua empresa hoje?..."
            rows={4}
            className="w-full rounded-md border border-input bg-card p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={enviando}
          />
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              disabled={enviando || !directMessage.trim()}
              onClick={() => void enviarDireto()}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.7} />
              {enviando ? "A enviar…" : "Enviar mensagem"}
            </Button>
            {templates && templates.length > 0 && (
              <button
                type="button"
                onClick={() => setUseTemplate(true)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                Usar modelo aprovado
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-3">Escolha o modelo aprovado:</p>
            <button
              type="button"
              onClick={() => setUseTemplate(false)}
              className="text-xs text-primary hover:underline"
            >
              ← Mensagem direta
            </button>
          </div>
          <select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setVars([]);
            }}
            aria-label="Modelo para iniciar conversa"
            className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
          >
            {templates?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.language})
              </option>
            ))}
          </select>

          {elegida && (
            <p className="rounded-md border bg-subtle px-3 py-2 text-[12px] text-text-2">
              {elegida.body}
            </p>
          )}

          {Array.from({ length: nVars }, (_, i) => (
            <Input
              key={i}
              value={vars[i] ?? ""}
              aria-label={`Valor da variável ${i + 1}`}
              placeholder={`Valor de {{${i + 1}}}`}
              onChange={(e) => {
                const next = [...vars];
                next[i] = e.target.value;
                setVars(next);
              }}
            />
          ))}

          <Button
            size="sm"
            disabled={enviando || !templateId || vars.slice(0, nVars).some((v) => !v?.trim())}
            onClick={() => void enviarModelo()}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.7} />
            {enviando ? "A enviar…" : "Enviar modelo"}
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-danger-text">{error}</p>}
    </div>
  );
}
