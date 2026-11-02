/**
 * 054 — Los eventos que se pintan en el hilo (cambios de etapa y el traspaso a
 * una persona): el DTO y su texto. Puro, para probarlo sin servidor.
 */
import { LOSS_REASON_LABEL, type LossReason, type StageChangeSource } from "./types";

export type EventoHiloDto = {
  id: string;
  tipo: "etapa" | "traspaso";
  texto: string;
  createdAt: string;
};

/**
 * Por que motivo a IA deixou de responder, con las palabras del panel del contacto.
 * `hostilidad` faltaba allá: se agrega aquí y el panel lo usa.
 */
export const HANDOFF_LABELS: Record<string, string> = {
  cliente: "O cliente pediu atendimento humano",
  modelo: "O agente decidiu escalar",
  error: "Erro do fornecedor de IA",
  ventana: "Janela de 24 horas fechada",
  hostilidad: "O cliente tornou-se agressivo e o agente retirou-se",
  manual_reply: "Respondeu a partir do telefone — IA pausada",
};

/** D1 — «Passou para Interesado · por Ana», «Entrou no funil em Nuevo»… */
export function textoEventoEtapa(e: {
  fromStageName: string | null;
  toStageName: string;
  lossReason: LossReason | string | null;
  source: StageChangeSource | string;
  actorNombre: string | null;
}): string {
  const base = e.fromStageName === null ? `Entrou no funil em ${e.toStageName}` : `Passou para ${e.toStageName}`;
  const motivo =
    e.lossReason && e.lossReason in LOSS_REASON_LABEL
      ? ` · ${LOSS_REASON_LABEL[e.lossReason as LossReason]}`
      : "";
  const quien = e.actorNombre
    ? ` · por ${e.actorNombre}`
    : e.source === "bot"
      ? " · pelo agente"
      : "";
  return `${base}${motivo}${quien}`;
}

/** D1 — «A IA foi pausada: el cliente pidió un humano». */
export function textoTraspaso(motivo: string | null): string {
  const etiqueta = motivo ? HANDOFF_LABELS[motivo] : undefined;
  if (!etiqueta) return "A IA foi pausada";
  return `A IA foi pausada: ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}`;
}
