import type { schema } from "@/lib/db";
import { renderKb } from "@/server/ai/prompts";
import { herramientasEfectivas, rolDe } from "@/lib/agent-roles";

type AgentProfile = typeof schema.agentProfile.$inferSelect;
type KbEntry = typeof schema.kbEntry.$inferSelect;

/**
 * Payload del perfil del agente para un cerebro externo.
 *
 * `enabled` NO viaja: ese flag gobierna la IA in-process de Vocero; el bot
 * externo se pausa por conversación (`aiEnabled` del contexto y los handoffs),
 * no por este endpoint. `resources` nace vacío para que el shape del consumidor
 * no cambie cuando existan recursos alternativos reales.
 *
 * 034 — `role` y `tools`: qué hace el agente y con qué herramientas (las
 * claves de `src/lib/agent-roles.ts`; `escalar` siempre). Aditivas: un cerebro
 * que no las conozca las ignora y enciende todo, como antes.
 *
 * 036 — `llm`: con qué piensa el cerebro sin llave propia. `path` es el proxy
 * (`/api/bot/llm`, que le pone la llave de Ajustes → IA) y `model`, el que
 * eligió el negocio. `null` sin proveedor de IA configurado o con la llave
 * pausada: el cerebro no tiene con qué pensar por el CRM.
 */
export type BotLlm = { path: string; model: string } | null;

const AGENTES_DIGITAL_OFFERS = [
  "Ofertas Agentes Digital (implementação / mensalidade, em Kz): PRESENÇA 125.000 / 20.000; PROFISSIONAL 250.000 / 50.000; AUTORIDADE 450.000 / 85.000; DOMÍNIO IA 700.000 / 150.000; AUTOMATE PRO 300.000 / 65.000. AUTOMATE PRO inclui quatro horas mensais.",
  "Diagnosticar a necessidade antes de recomendar. Recomendar uma oferta; mostrar uma segunda apenas se houver dúvida real de adequação. Não inventar funcionalidades, preços ou condições comerciais. Prazos, garantias, reembolsos, custos de terceiros, duração contratual e métodos de pagamento não definidos devem ser confirmados por uma pessoa. Nunca confirmar pagamento nem declarar negócio ganho; encaminhar comprovativos para verificação humana.",
].join("\n");

export function serializeBotProfile(profile: AgentProfile, kb: KbEntry[], llm: BotLlm = null) {
  return {
    profile: {
      name: profile.name,
      tone: profile.tone ?? null,
      instructions: profile.instructions ?? null,
      escalationRules: profile.escalationRules ?? null,
      greeting: profile.greeting ?? null,
      role: rolDe(profile.role).clave,
      tools: herramientasEfectivas(profile.tools),
    },
    kb: `${renderKb(kb)}\n\n${AGENTES_DIGITAL_OFFERS}`,
    resources: [] as { label: string; url: string }[],
    llm,
  };
}
