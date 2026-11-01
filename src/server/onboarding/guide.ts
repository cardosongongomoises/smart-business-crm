import type { SessionContext } from "@/lib/auth/session";
import { canConfigure } from "@/lib/auth/roles";
import {
  onboardingStatus,
  type OnboardingStatus,
  type ReadinessStep,
} from "./status";

/**
 * La guía de inicio: cuatro pasos (cinco con la agenda) y nada más (issue #86).
 * 036 — «Conecta tu agente» es opcional: sin él, Vocero es una bandeja manual.
 *
 * Es lo primero que ve quien instala Vocero: configurar el agente, vincular
 * el proveedor de IA, conectar el número y, si la agenda existe en esta
 * instancia, dejarla lista. Al terminar, un botón enciende el agente. Lo
 * demás —la Bandeja, el Pipeline— ya está en el menú; la guía no lo repite.
 *
 * El estado de cada paso sale de `onboardingStatus`, la misma fuente que ya
 * verifica cada conexión: la guía no inventa su propia noción de «listo».
 * Puerto de `onboarding/guide.ts` de Vocero Cloud sin lo que allá es de la
 * plataforma (modelo fijado por soporte, agencias, planes).
 */
export type GuideStep = {
  key: "agent" | "ai" | "whatsapp" | "brain" | "calendar";
  title: string;
  description: string;
  done: boolean;
  /** 036 — En «Conecta tu agente» es externo (la receta del par): se hace en
   *  el entorno, no en una pantalla. */
  href: string;
  cta: string;
  /** Lo que falta, cuando no es lo obvio del paso. */
  hint: string | null;
  /** 036 — No cuenta para `complete`: sin cerebro, Vocero es una bandeja
   *  manual, y eso es un producto válido. */
  optional?: boolean;
};

export type Guide = {
  steps: GuideStep[];
  complete: boolean;
  /** El agente ya está encendido. */
  enabled: boolean;
  /** 036 — Hay un cerebro conectado y sano: tiene sentido encender. */
  brainConnected: boolean;
};

/** 036 — A dónde lleva «Conecta tu agente»: la receta del par. */
export const GUIA_DEL_PAR =
  "https://github.com/kevinrivm/vocero-crm/blob/main/docs/migrar-a-2.0.md#el-par-crm--nea";

const ready = (s: ReadinessStep | undefined) => s?.status === "ready";

/** Pura: de los pasos verificados a los de la guía. */
export function guideFrom(status: OnboardingStatus): Guide {
  const step = (key: ReadinessStep["key"]) =>
    status.steps.find((s) => s.key === key);
  const profile = step("profile");
  const ai = step("ai");
  const whatsapp = step("whatsapp");
  const calendar = step("calendar");
  const brain = step("brain");

  const steps: GuideStep[] = [
    {
      key: "agent",
      title: "Configure o seu agente",
      description:
        "Dê-lhe um nome e descreva a actividade da sua empresa. Se preferir ver um exemplo primeiro, carregue a demonstração a partir da Caixa de entrada e adapte com os seus dados.",
      done: ready(profile),
      href: "/agent",
      cta: "Ir para Agente",
      hint: ready(profile) ? null : (profile?.nextAction ?? null),
    },
    {
      key: "ai",
      title: "Ligue o seu fornecedor de IA",
      description:
        "É a conta através da qual o seu agente processa raciocínios: OpenRouter ou qualquer fornecedor compatível com a API da OpenAI. Apenas necessita de colar a chave de API e selecionar o modelo.",
      done: ready(ai),
      href: "/settings/ai",
      cta: "Associar fornecedor",
      hint: ai?.problem ?? null,
    },
    {
      key: "whatsapp",
      title: "Ligue o seu número de WhatsApp",
      description:
        "Ligue o número de telefone onde os seus clientes entram em contacto.",
      done: ready(whatsapp),
      href: "/settings/whatsapp",
      cta: "Ligar WhatsApp",
      hint: whatsapp?.problem ?? null,
    },
    {
      key: "brain",
      title: "Ligue o agente externo",
      description:
        "O CRM pode funcionar como caixa de entrada manual para respostas humanas, ou ligar a um agente autónomo externo.",
      done: ready(brain),
      href: GUIA_DEL_PAR,
      cta: "Como ligar",
      hint: ready(brain) ? null : (brain?.problem ?? brain?.nextAction ?? null),
      optional: true,
    },
  ];
  // Sin agenda en esta instancia el paso no existe: pintarlo «no aplica»
  // sería justo el tipo de ruido que la guía evita.
  if (calendar && calendar.status !== "not_applicable") {
    steps.push({
      key: "calendar",
      title: "Configure a sua agenda",
      description:
        "Defina os seus horários de atendimento para que o sistema possa gerir marcações.",
      done: ready(calendar),
      href: "/settings/calendar",
      cta: "Configurar agenda",
      hint: calendar.problem,
    });
  }
  return {
    steps,
    complete: steps.every((s) => s.done || s.optional),
    enabled: status.enabled,
    brainConnected: ready(brain),
  };
}

export async function guideStatus(organizationId: string): Promise<Guide> {
  return guideFrom(await onboardingStatus(organizationId));
}

/**
 * ¿La guía es lo primero que ve esta persona al entrar?
 *
 * Solo a quien puede configurar (un miembro del equipo no puede hacer ninguno
 * de los pasos) y solo mientras falte algo: con todos los pasos listos y el
 * agente encendido se entra directo a la Bandeja, como siempre.
 *
 * Un negocio demo recién sembrado («Ferretería El Martillo») pasa por aquí
 * igual: el seed deja el agente configurado (paso 1 listo) pero no puede
 * vincular una llave de IA ni un número, y sin eso el agente no contesta.
 * Capturar `/` no encierra a nadie: el menú lleva a cualquier pantalla.
 */
export async function guideFirst(
  session: Pick<SessionContext, "organizationId" | "role">
): Promise<boolean> {
  if (!canConfigure(session.role)) return false;
  const guide = await guideStatus(session.organizationId);
  // 036 — Una bandeja manual (sin cerebro) no se queda atrapada en la guía.
  return !guide.complete || (guide.brainConnected && !guide.enabled);
}
