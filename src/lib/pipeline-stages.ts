export type PipelineStageKind = "open" | "won" | "lost";

export type WorkflowPipelineStage = {
  name: string;
  kind: PipelineStageKind;
  owner: string;
  position: number;
};

export type ExistingPipelineStage = {
  id: string;
  name: string;
  position: number;
  kind: PipelineStageKind;
};

export type WorkflowStageBootstrapPlan = {
  updates: { id: string; name: string; position: number }[];
  inserts: { name: string; kind: PipelineStageKind; position: number }[];
};

const STAGE_DEFINITIONS = [
  { name: "Identificado", kind: "open", owner: "Ana (SDR)" },
  { name: "Abordado", kind: "open", owner: "Ana (SDR)" },
  { name: "Respondeu", kind: "open", owner: "Ana (SDR)" },
  { name: "Pronto para SDR", kind: "open", owner: "Ana (SDR)" },
  { name: "Qualificação", kind: "open", owner: "Ana (SDR)" },
  { name: "Qualificado", kind: "open", owner: "Ana (SDR)" },
  { name: "Sem resposta", kind: "open", owner: "Ana (SDR)" },
  { name: "Nutrição", kind: "open", owner: "Ana (SDR)" },
  { name: "Reunião agendada", kind: "open", owner: "Rafael (Closer)" },
  { name: "No-show", kind: "open", owner: "Ana (SDR)" },
  { name: "Demonstração realizada", kind: "open", owner: "Rafael (Closer)" },
  { name: "Proposta enviada", kind: "open", owner: "Rafael (Closer)" },
  { name: "Pronto para fechar", kind: "open", owner: "Rafael (Closer)" },
  { name: "Aguarda pagamento", kind: "open", owner: "Bruno (Financeiro / CAC)" },
  { name: "Ganho", kind: "won", owner: "Lúcia (Onboarding)" },
  { name: "Onboarding", kind: "open", owner: "Lúcia (Onboarding)" },
  { name: "Homologação", kind: "open", owner: "Lúcia (Onboarding)" },
  { name: "Go-live", kind: "open", owner: "Sofia (Customer Success)" },
  { name: "Ativo", kind: "open", owner: "Sofia (Customer Success)" },
  { name: "Em risco", kind: "open", owner: "Sofia (Customer Success)" },
  { name: "Inativo", kind: "open", owner: "Sofia (Customer Success)" },
  { name: "Renovação / expansão", kind: "open", owner: "Carlos (Gestor de Contas)" },
  { name: "Descartado", kind: "lost", owner: "Ana (SDR)" },
  { name: "Perdido", kind: "lost", owner: "Ana (SDR)" },
] as const satisfies readonly {
  name: string;
  kind: PipelineStageKind;
  owner: string;
}[];

export const WORKFLOW_PIPELINE_STAGES: readonly WorkflowPipelineStage[] =
  STAGE_DEFINITIONS.map((stage, position) => ({ ...stage, position }));

export function normalizePipelineStageName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const workflowStagesByName = new Map(
  WORKFLOW_PIPELINE_STAGES.map((stage) => [
    normalizePipelineStageName(stage.name),
    stage,
  ])
);

/** Nome do agente do workflow publicado, ou null para etapas personalizadas. */
export function workflowOwnerForStage(name: string): string | null {
  return workflowStagesByName.get(normalizePipelineStageName(name))?.owner ?? null;
}

const LEGACY_STAGE_MAPPINGS: Record<
  string,
  { canonicalName: string; expectedKind: PipelineStageKind }
> = {
  nuevo: { canonicalName: "Identificado", expectedKind: "open" },
  "en conversacion": { canonicalName: "Respondeu", expectedKind: "open" },
  interesado: { canonicalName: "Qualificação", expectedKind: "open" },
  cliente: { canonicalName: "Ganho", expectedKind: "won" },
  perdido: { canonicalName: "Perdido", expectedKind: "lost" },
};

/**
 * Faz a migração apenas de configuração, sem tocar em leads: reutiliza os IDs
 * das cinco etapas padrão em espanhol e deixa qualquer etapa personalizada no
 * quadro. O chamador aplica as alterações dentro de uma transação tenant-scoped.
 */
export function planWorkflowStageBootstrap(
  existing: readonly ExistingPipelineStage[]
): WorkflowStageBootstrapPlan | null {
  const alreadyConfigured = existing.some((stage) => {
    const normalized = normalizePipelineStageName(stage.name);
    return workflowStagesByName.has(normalized) && !LEGACY_STAGE_MAPPINGS[normalized];
  });
  if (alreadyConfigured) return null;

  const usedIds = new Set<string>();
  const updates: WorkflowStageBootstrapPlan["updates"] = [];
  const inserts: WorkflowStageBootstrapPlan["inserts"] = [];

  for (const workflowStage of WORKFLOW_PIPELINE_STAGES) {
    const reusable = existing.find((stage) => {
      const legacy = LEGACY_STAGE_MAPPINGS[
        normalizePipelineStageName(stage.name)
      ];
      return (
        !usedIds.has(stage.id) &&
        legacy?.canonicalName === workflowStage.name &&
        legacy.expectedKind === stage.kind
      );
    });

    if (reusable) {
      usedIds.add(reusable.id);
      updates.push({
        id: reusable.id,
        name: workflowStage.name,
        position: workflowStage.position,
      });
    } else {
      inserts.push({
        name: workflowStage.name,
        kind: workflowStage.kind,
        position: workflowStage.position,
      });
    }
  }

  const customStages = existing
    .filter((stage) => !usedIds.has(stage.id))
    .sort((a, b) => a.position - b.position);
  customStages.forEach((stage, index) => {
    const position = WORKFLOW_PIPELINE_STAGES.length + index;
    if (stage.position !== position) {
      updates.push({ id: stage.id, name: stage.name, position });
    }
  });

  return { updates, inserts };
}
