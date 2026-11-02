import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { planWorkflowStageBootstrap } from "@/lib/pipeline-stages";

/**
 * Alinha uma única organização às etapas do workflow ao abrir o Pipeline.
 * A transação altera apenas configuração de `pipeline_stage`; IDs e linhas de
 * leads permanecem intactos. O lock por organização torna a primeira execução
 * segura quando dois utilizadores abrem o quadro ao mesmo tempo.
 */
export async function ensureWorkflowStagesForOrganization(
  organizationId: string
): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`pipeline-workflow:${organizationId}`}, 0))`
    );

    const existing = await tx
      .select({
        id: schema.pipelineStage.id,
        name: schema.pipelineStage.name,
        position: schema.pipelineStage.position,
        kind: schema.pipelineStage.kind,
      })
      .from(schema.pipelineStage)
      .where(scoped(schema.pipelineStage.organizationId, organizationId))
      .orderBy(asc(schema.pipelineStage.position));

    const plan = planWorkflowStageBootstrap(existing);
    if (!plan) return;

    for (const update of plan.updates) {
      await tx
        .update(schema.pipelineStage)
        .set({ name: update.name, position: update.position })
        .where(
          scoped(
            schema.pipelineStage.organizationId,
            organizationId,
            eq(schema.pipelineStage.id, update.id)
          )
        );
    }

    if (plan.inserts.length > 0) {
      await tx.insert(schema.pipelineStage).values(
        plan.inserts.map((stage) => ({
          id: newId("stage"),
          organizationId,
          name: stage.name,
          position: stage.position,
          kind: stage.kind,
        }))
      );
    }
  });
}
