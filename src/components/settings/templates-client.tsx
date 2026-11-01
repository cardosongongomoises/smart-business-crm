"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Inbox,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import type { TemplateDto } from "@/lib/types";
import {
  countVariables,
  renderBody,
  templateWarnings,
  validateBodyVariables,
} from "@/lib/templates";
import {
  DEFAULT_TEMPLATE_LANGUAGE,
  TEMPLATE_LANGUAGE_GROUPS,
  TEMPLATE_LANGUAGES,
  templateLanguageName,
} from "@/lib/template-languages";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Category = "UTILITY" | "MARKETING";

const STATUS_BADGE: Record<
  TemplateDto["status"],
  { label: string; variant: "secondary" | "warning" | "success" | "destructive"; hint: string }
> = {
  draft: { label: "Rascunho", variant: "secondary", hint: "Guardado, ainda não enviado à Meta." },
  pending: { label: "Em revisão", variant: "warning", hint: "A Meta está a rever. Costuma demorar de alguns minutos a 24 horas." },
  approved: { label: "Aprovado", variant: "success", hint: "Pronto a utilizar na Caixa de entrada ou em Contactos." },
  rejected: { label: "Rejeitado", variant: "destructive", hint: "Corrija e crie novamente com outro nome." },
};

const CATEGORY: Record<Category, { label: string; description: string }> = {
  UTILITY: {
    label: "Utilidade",
    description: "Acompanhamento de algo que o cliente solicitou: uma marcação, um orçamento, um pedido.",
  },
  MARKETING: {
    label: "Marketing",
    description: "Promoções, ofertas, convites ou reatar contacto com quem não comprou.",
  },
};

/** Puntos de partida: rellenan el formulario, el dueño los ajusta a su negocio. */
const STARTERS: {
  title: string;
  name: string;
  category: Category;
  body: string;
  examples: string[];
}[] = [
  {
    title: "Seguimento de orçamento",
    name: "seguimento_orcamento",
    category: "UTILITY",
    body: "Olá {{1}}, escrevo para dar seguimento ao orçamento que lhe enviámos. Tem alguma dúvida ou gostaria de rever connosco?",
    examples: ["Ana"],
  },
  {
    title: "Lembrete de marcação",
    name: "lembrete_marcacao",
    category: "UTILITY",
    body: "Olá {{1}}, lembramos a sua marcação de {{2}} às {{3}}. Se precisar de alterar, responda a esta mensagem.",
    examples: ["Ana", "terça-feira 14 de outubro", "10:30"],
  },
  {
    title: "Retomar conversa",
    name: "retomar_conversa",
    category: "MARKETING",
    body: "Olá {{1}}, ainda tem interesse em {{2}}? Esta semana temos vagas disponíveis. Responda a esta mensagem para ajudarmos.",
    examples: ["Ana", "na consulta de avaliação"],
  },
];

/** Meta solo acepta minúsculas, números y guion bajo en el nombre. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function TemplatesClient() {
  const [templates, setTemplates] = useState<TemplateDto[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch("/api/templates").catch(() => null);
    if (!res?.ok) {
      setTemplates((current) => current ?? []);
      return;
    }
    const data = (await res.json()) as { templates: TemplateDto[] };
    setTemplates(data.templates);
  }, []);

  /**
   * `silent`: sincronización automática al abrir la pantalla. Meta entrega
   * `message_template_status_update` al callback A NIVEL APP, que en modo
   * agencia no es el de esta instancia — sin este pull la plantilla se queda
   * "Pendiente de Meta" para siempre aunque ya esté aprobada.
   */
  const sync = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setSyncing(true);
        setSyncMsg(null);
      }
      const res = await fetch("/api/templates/sync", { method: "POST" }).catch(
        () => null
      );
      if (!silent) setSyncing(false);
      if (res?.ok) {
        const data = (await res.json()) as { updated: number };
        if (!silent) {
          setSyncMsg(
            data.updated > 0
              ? `${data.updated} modelo(s) actualizado(s)`
              : "Tudo actualizado"
          );
        }
        if (!silent || data.updated > 0) void refetch();
      } else if (!silent) {
        // El auto-sync falla en silencio: la lista local ya se pintó.
        const data = (await res?.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setSyncMsg(data?.error?.message ?? "Não foi possível sincronizar");
      }
    },
    [refetch]
  );

  useEffect(() => {
    void refetch().then(() => sync({ silent: true }));
  }, [refetch, sync]);

  const empty = templates !== null && templates.length === 0;

  return (
    <div className="max-w-3xl space-y-6">
      <HowItWorks defaultOpen={empty} />

      <section className="space-y-3" aria-labelledby="tpl-list-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="tpl-list-title" className="text-base font-semibold">
            Os seus modelos
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={syncing}
              onClick={() => void sync()}
              title="Consulta à Meta o estado de revisão"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Actualizar estado
            </Button>
            {!creating && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                Novo modelo
              </Button>
            )}
          </div>
        </div>
        {syncMsg && <p className="text-xs text-muted-foreground">{syncMsg}</p>}

        {creating && (
          <CreateForm
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              void refetch();
            }}
          />
        )}

        {templates === null ? (
          <p className="text-sm text-muted-foreground">A carregar modelos…</p>
        ) : empty ? (
          !creating && (
            <EmptyState
              icon={FileText}
              className="rounded-lg border border-dashed"
              title="Ainda não tem modelos"
              description="Crie o primeiro para poder escrever a um cliente após passarem as 24 horas. Pode começar com um exemplo."
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" />
                  Criar o meu primeiro modelo
                </Button>
              }
            />
          )
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-sm font-medium">{t.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {templateLanguageName(t.language)} ·{" "}
                      {CATEGORY[t.category as Category]?.label ?? t.category}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[t.status].variant}>
                    {STATUS_BADGE[t.status].label}
                  </Badge>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{t.body}</p>
                <p
                  className={cn(
                    "mt-3 text-xs",
                    t.status === "rejected" ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {t.status === "rejected" && t.rejectionReason
                    ? `Motivo da rejeição: ${t.rejectionReason}. ${STATUS_BADGE.rejected.hint}`
                    : STATUS_BADGE[t.status].hint}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** La explicación: para qué sirven, cómo se aprueban y dónde se usan. */
function HowItWorks({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  // Se abre sola la primera vez que la lista llega vacía.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const steps = [
    {
      icon: Plus,
      title: "Crie aqui",
      text: "Escreva a mensagem e marque com {{1}}, {{2}}… o que varia em cada envio, como o nome ou a data.",
    },
    {
      icon: Clock3,
      title: "A Meta revê",
      text: "Demora de alguns minutos a 24 horas. O estado muda automaticamente para «Aprovado» ou «Rejeitado», com o motivo.",
    },
    {
      icon: Send,
      title: "Utilize",
      text: "Na Caixa de entrada, quando a janela de 24 h estiver fechada, escolha o modelo, preencha as variáveis e envie. Para escrever primeiro, use «Iniciar conversa» em Contactos.",
    },
  ];

  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1">
          <span className="block text-sm font-semibold">Para que servem os modelos?</span>
          <span className="block text-xs text-muted-foreground">
            São a única mensagem que o WhatsApp permite enviar passadas 24 horas.
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t p-4 text-sm">
          <p className="text-muted-foreground">
            O WhatsApp apenas permite escrever livremente durante as 24 horas
            seguintes à última mensagem do seu cliente. Passado esse tempo — ou
            para escrever a alguém que nunca lhe enviou mensagem — necessita de um
            modelo pré-aprovado pela Meta.
          </p>
          <ol className="grid gap-3 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-md border bg-background p-3">
                <p className="flex items-center gap-2 font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  {s.title}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <details className="rounded-md bg-subtle p-3">
            <summary className="cursor-pointer font-medium">Dicas para aprovação pela Meta</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Não comece nem termine a mensagem com uma variável, e não coloque duas variáveis juntas.</li>
              <li>Identifique quem escreve e o motivo: «Olá {"{{1}}"}, daqui é a Ana da Clínica Sol…».</li>
              <li>Escreva exemplos reais para cada variável: é o que o revisor da Meta analisa.</li>
              <li>Utilidade destina-se apenas a seguimento de algo solicitado pelo cliente. Se promover algo, a Meta converte para Marketing, que tem custo diferente.</li>
              <li>O idioma selecionado deve corresponder ao texto da mensagem.</li>
            </ul>
          </details>
          <p className="flex flex-wrap gap-4 text-xs">
            <Link className="inline-flex items-center gap-1 underline" href="/inbox">
              <Inbox className="h-3.5 w-3.5" /> Ir para a Caixa de entrada
            </Link>
            <Link className="inline-flex items-center gap-1 underline" href="/contacts">
              <Send className="h-3.5 w-3.5" /> Ir para Contactos
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}

function CreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState(DEFAULT_TEMPLATE_LANGUAGE);
  const [category, setCategory] = useState<Category>("UTILITY");
  const [body, setBody] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Misma validación que el servidor: avisa antes de gastar una llamada a Meta.
  const bodyError = body.trim() ? validateBodyVariables(body) : null;
  const variableCount = bodyError ? 0 : countVariables(body);
  const warnings = bodyError ? [] : templateWarnings(body);
  const preview = renderBody(
    body,
    Array.from({ length: variableCount }, (_, i) => examples[i]?.trim() || `[variable ${i + 1}]`)
  );

  function applyStarter(s: (typeof STARTERS)[number]) {
    setName(s.name);
    setCategory(s.category);
    setBody(s.body);
    setExamples(s.examples);
    setError(null);
  }

  /** Inserta la siguiente variable donde está el cursor. */
  function insertVariable() {
    const next = `{{${countVariables(body) + 1}}}`;
    const el = document.getElementById("tpl-body") as HTMLTextAreaElement | null;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const value = body.slice(0, start) + next + body.slice(end);
    setBody(value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + next.length, start + next.length);
    });
  }

  async function create() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        language,
        category,
        body,
        examples: examples.slice(0, variableCount),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "Não foi possível criar o modelo");
      return;
    }
    onCreated();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo modelo</CardTitle>
        <CardDescription>
          É enviado para revisão da Meta ao criar. Enquanto é revisto pode
          continuar a usar o CRM normalmente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Comece com um exemplo (opcional)</p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <Button key={s.name} type="button" variant="outline" size="sm" onClick={() => applyStarter(s)}>
                {s.title}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nome interno</Label>
            <Input
              id="tpl-name"
              placeholder="seguimento_orcamento"
              value={name}
              onChange={(e) => setName(normalizeName(e.target.value))}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              Apenas minúsculas, números e sublinhado. Os seus clientes não vêem este nome.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-lang">Idioma da mensagem</Label>
            <select
              id="tpl-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              {TEMPLATE_LANGUAGE_GROUPS.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {TEMPLATE_LANGUAGES.filter((l) => l.group === g.id).map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Qual a finalidade?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(CATEGORY) as Category[]).map((c) => (
              <label
                key={c}
                className={cn(
                  "cursor-pointer rounded-md border p-3 text-sm transition-colors",
                  category === c ? "border-primary bg-brand-tint" : "hover:bg-accent"
                )}
              >
                <input
                  type="radio"
                  name="tpl-category"
                  value={c}
                  checked={category === c}
                  onChange={() => setCategory(c)}
                  className="sr-only"
                />
                <span className="block font-medium">{CATEGORY[c].label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{CATEGORY[c].description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="tpl-body">Mensagem</Label>
            <Button type="button" variant="ghost" size="sm" onClick={insertVariable}>
              <Plus className="h-3.5 w-3.5" />
              Inserir variável {`{{${countVariables(body) + 1}}}`}
            </Button>
          </div>
          <Textarea
            id="tpl-body"
            rows={4}
            placeholder="Olá {{1}}, confirmo a sua sessão em {{2}} às {{3}}. Se precisar de alterar, responda a esta mensagem."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {bodyError ? (
            <p className="text-xs text-destructive">{bodyError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              As variáveis são preenchidas ao enviar: {"{{1}}"} pode ser o nome
              do cliente, {"{{2}}"} uma data…
            </p>
          )}
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5 text-xs text-warning-text">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>

        {variableCount > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Exemplo de cada variável</p>
            <p className="text-xs text-muted-foreground">
              A Meta usa estes exemplos para rever o modelo. Não são enviados aos clientes.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: variableCount }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Label htmlFor={`tpl-example-${i + 1}`} className="w-10 shrink-0 font-mono text-xs">
                    {`{{${i + 1}}}`}
                  </Label>
                  <Input
                    id={`tpl-example-${i + 1}`}
                    placeholder={i === 0 ? "Ana" : "p. ex. terça-feira 14"}
                    value={examples[i] ?? ""}
                    onChange={(e) => {
                      const next = [...examples];
                      next[i] = e.target.value;
                      setExamples(next);
                    }}
                    maxLength={200}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {body.trim() && !bodyError && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Assim verá o seu cliente</p>
            <div className="rounded-lg bg-chat p-4">
              <div className="ml-auto max-w-[85%] rounded-lg border border-bubble-out-border bg-bubble-out px-3 py-2 text-sm text-bubble-out-text shadow-sm">
                <p className="whitespace-pre-wrap">{preview}</p>
                <p className="mt-1 text-right text-[10px] opacity-60">10:30</p>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={saving || !name.trim() || !body.trim() || bodyError !== null}
            onClick={() => void create()}
          >
            {saving ? "A enviar para a Meta…" : "Criar e enviar para revisão"}
          </Button>
          <Button variant="outline" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Quando a Meta aprovar, aparecerá na Caixa de entrada, pronta a enviar.
        </p>
      </CardContent>
    </Card>
  );
}
