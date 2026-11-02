import { describe, expect, it } from "vitest";
import {
  planWorkflowStageBootstrap,
  workflowOwnerForStage,
  WORKFLOW_PIPELINE_STAGES,
  type ExistingPipelineStage,
} from "@/lib/pipeline-stages";

const LEGACY_STAGES: ExistingPipelineStage[] = [
  { id: "stage-new", name: "Nuevo", position: 0, kind: "open" },
  {
    id: "stage-conversation",
    name: "En conversación",
    position: 1,
    kind: "open",
  },
  { id: "stage-interested", name: "Interesado", position: 2, kind: "open" },
  { id: "stage-client", name: "Cliente", position: 3, kind: "won" },
  { id: "stage-lost", name: "Perdido", position: 4, kind: "lost" },
];

describe("etapas do workflow WhatsApp", () => {
  it("espelha os 24 estados do fluxo com rótulos em português e responsáveis", () => {
    expect(WORKFLOW_PIPELINE_STAGES.map((stage) => stage.name)).toEqual([
      "Identificado",
      "Abordado",
      "Respondeu",
      "Pronto para SDR",
      "Qualificação",
      "Qualificado",
      "Sem resposta",
      "Nutrição",
      "Reunião agendada",
      "No-show",
      "Demonstração realizada",
      "Proposta enviada",
      "Pronto para fechar",
      "Aguarda pagamento",
      "Ganho",
      "Onboarding",
      "Homologação",
      "Go-live",
      "Ativo",
      "Em risco",
      "Inativo",
      "Renovação / expansão",
      "Descartado",
      "Perdido",
    ]);
    expect(new Set(WORKFLOW_PIPELINE_STAGES.map((stage) => stage.position)).size).toBe(24);
    expect(WORKFLOW_PIPELINE_STAGES.every((stage) => stage.owner.length > 0)).toBe(true);
  });

  it("apresenta os agentes do n8n e não inventa um agente para etapas personalizadas", () => {
    expect(workflowOwnerForStage("Nutrição")).toBe("Ana (SDR)");
    expect(workflowOwnerForStage("Reunião agendada")).toBe("Rafael (Closer)");
    expect(workflowOwnerForStage("Aguarda pagamento")).toBe("Bruno (Financeiro / CAC)");
    expect(workflowOwnerForStage("Ganho")).toBe("Lúcia (Onboarding)");
    expect(workflowOwnerForStage("Go-live")).toBe("Sofia (Customer Success)");
    expect(workflowOwnerForStage("Renovação / expansão")).toBe(
      "Carlos (Gestor de Contas)"
    );
    expect(workflowOwnerForStage("Etapa personalizada")).toBeNull();
  });

  it("reaproveita IDs das etapas padrão, acrescenta as ausentes e mantém etapas personalizadas", () => {
    const custom: ExistingPipelineStage = {
      id: "stage-custom",
      name: "Acompanhamento especial",
      position: 5,
      kind: "open",
    };
    const plan = planWorkflowStageBootstrap([...LEGACY_STAGES, custom]);

    expect(plan).not.toBeNull();
    expect(plan?.updates).toEqual(
      expect.arrayContaining([
        { id: "stage-new", name: "Identificado", position: 0 },
        { id: "stage-conversation", name: "Respondeu", position: 2 },
        { id: "stage-interested", name: "Qualificação", position: 4 },
        { id: "stage-client", name: "Ganho", position: 14 },
        { id: "stage-lost", name: "Perdido", position: 23 },
        {
          id: "stage-custom",
          name: "Acompanhamento especial",
          position: 24,
        },
      ])
    );
    expect(plan?.inserts).toHaveLength(19);
    expect(plan?.updates.map((update) => update.id)).toContain("stage-custom");
    expect(plan?.updates.some((update) => update.id === "stage-new")).toBe(true);
  });

  it("não volta a migrar um quadro que já contém uma etapa canónica", () => {
    const configured: ExistingPipelineStage = {
      id: "stage-identified",
      name: "Identificado",
      position: 0,
      kind: "open",
    };
    expect(planWorkflowStageBootstrap([...LEGACY_STAGES, configured])).toBeNull();
  });

  it("não reutiliza uma etapa padrão cuja categoria não corresponda", () => {
    const inconsistent = LEGACY_STAGES.map((stage) =>
      stage.id === "stage-client" ? { ...stage, kind: "open" as const } : stage
    );
    const plan = planWorkflowStageBootstrap(inconsistent);

    expect(
      plan?.updates.some(
        (update) => update.id === "stage-client" && update.name === "Ganho"
      )
    ).toBe(false);
    expect(
      plan?.updates.find((update) => update.id === "stage-client")?.name
    ).toBe("Cliente");
    expect(plan?.inserts).toContainEqual({
      name: "Ganho",
      kind: "won",
      position: 14,
    });
  });
});
