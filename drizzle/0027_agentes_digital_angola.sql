UPDATE "calendar_settings"
SET "timezone" = 'Africa/Luanda'
WHERE "timezone" = 'America/Mexico_City';

DO $migration$
DECLARE
  v_org RECORD;
  v_mapping RECORD;
  v_old_id text;
  v_new_id text;
BEGIN
  FOR v_org IN SELECT DISTINCT "organization_id" FROM "pipeline_stage" LOOP
    FOR v_mapping IN
      SELECT * FROM (VALUES
        ('Reunião agendada', 'Diagnóstico concluído'),
        ('No-show', 'Sem resposta'),
        ('Demonstração realizada', 'Oferta recomendada'),
        ('Pronto para fechar', 'Dúvidas e decisão')
      ) AS mappings(old_name, new_name)
    LOOP
      v_old_id := NULL;
      v_new_id := NULL;
      SELECT "id" INTO v_old_id FROM "pipeline_stage"
        WHERE "organization_id" = v_org."organization_id" AND "name" = v_mapping.old_name
        ORDER BY "position" LIMIT 1;
      SELECT "id" INTO v_new_id FROM "pipeline_stage"
        WHERE "organization_id" = v_org."organization_id" AND "name" = v_mapping.new_name
        ORDER BY "position" LIMIT 1;

      IF v_old_id IS NOT NULL AND v_new_id IS NOT NULL THEN
        UPDATE "lead" SET "stage_id" = v_new_id WHERE "stage_id" = v_old_id;
        -- Keep the append-only stage history and its name snapshots intact.
        -- The event foreign keys use ON DELETE SET NULL when the old stage is removed.
        UPDATE "capi_settings" SET "qualified_stage_id" = v_new_id
          WHERE "qualified_stage_id" = v_old_id;
        DELETE FROM "pipeline_stage" WHERE "id" = v_old_id;
      ELSIF v_old_id IS NOT NULL THEN
        UPDATE "pipeline_stage" SET "name" = v_mapping.new_name WHERE "id" = v_old_id;
      END IF;
    END LOOP;

    UPDATE "pipeline_stage" AS stage
    SET "position" = desired.position
    FROM (VALUES
      ('Identificado', 0), ('Abordado', 1), ('Respondeu', 2),
      ('Pronto para SDR', 3), ('Qualificação', 4), ('Qualificado', 5),
      ('Sem resposta', 6), ('Nutrição', 7), ('Diagnóstico concluído', 8),
      ('Oferta recomendada', 9), ('Proposta enviada', 10),
      ('Dúvidas e decisão', 11), ('Aguarda pagamento', 12), ('Ganho', 13),
      ('Onboarding', 14), ('Homologação', 15), ('Go-live', 16), ('Ativo', 17),
      ('Em risco', 18), ('Inativo', 19), ('Renovação / expansão', 20),
      ('Descartado', 21), ('Perdido', 22)
    ) AS desired(name, position)
    WHERE stage."organization_id" = v_org."organization_id"
      AND stage."name" = desired.name;

    WITH custom_stages AS (
      SELECT "id", 22 + row_number() OVER (ORDER BY "position", "id") AS next_position
      FROM "pipeline_stage"
      WHERE "organization_id" = v_org."organization_id"
        AND "name" NOT IN (
          'Identificado', 'Abordado', 'Respondeu', 'Pronto para SDR',
          'Qualificação', 'Qualificado', 'Sem resposta', 'Nutrição',
          'Diagnóstico concluído', 'Oferta recomendada', 'Proposta enviada',
          'Dúvidas e decisão', 'Aguarda pagamento', 'Ganho', 'Onboarding',
          'Homologação', 'Go-live', 'Ativo', 'Em risco', 'Inativo',
          'Renovação / expansão', 'Descartado', 'Perdido'
        )
    )
    UPDATE "pipeline_stage" AS stage
    SET "position" = custom_stages.next_position
    FROM custom_stages
    WHERE stage."id" = custom_stages."id";
  END LOOP;
END;
$migration$;
ALTER TABLE "calendar_settings" ALTER COLUMN "timezone" SET DEFAULT 'Africa/Luanda';
