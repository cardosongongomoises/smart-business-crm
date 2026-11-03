import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { getContactById } from "@/server/contacts";
import { getOrCreateConversation } from "@/server/inbox/ingest";
import { SendError, sendText } from "@/server/inbox/send";
import { isWindowOpen } from "@/server/inbox/window";
import {
  sendTemplate,
  TemplateError,
  templateErrorStatus,
} from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.union([
  z.object({
    message: z.string().trim().min(1).max(4096),
  }),
  z.object({
    templateId: z.string().min(1),
    variables: z.array(z.string().trim().max(500)).max(10).optional(),
  }),
]);

/**
 * Abre a conversa com um contacto. Com a Avisa API / WhatsApp, permite
 * enviar uma mensagem direta ou modelo aprovado.
 */
export const POST = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const contact = await getContactById(session.organizationId, id);
  if (!contact) return apiError(404, "not_found", "Contacto não encontrado");
  if (!contact.phone && !contact.waIdentity) {
    return apiError(422, "no_identity", "Não há um canal disponível para iniciar uma conversa com este contacto.");
  }

  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const existing = await db
    .select({ id: schema.conversation.id, lastInboundAt: schema.conversation.lastInboundAt })
    .from(schema.conversation)
    .where(
      scoped(
        schema.conversation.organizationId,
        session.organizationId,
        eq(schema.conversation.contactId, id),
        eq(schema.conversation.isTest, false)
      )
    )
    .limit(1);

  if ("templateId" in body.data && existing[0] && isWindowOpen(existing[0].lastInboundAt)) {
    return apiError(
      409,
      "window_open",
      "Esta pessoa escreveu-lhe há menos de 24 horas: pode responder-lhe directamente a partir da Caixa de entrada, sem modelo"
    );
  }

  const conversation =
    existing[0] ?? (await getOrCreateConversation(session.organizationId, id));

  try {
    if ("message" in body.data) {
      const result = await sendText({
        organizationId: session.organizationId,
        conversationId: conversation.id,
        text: body.data.message,
      });
      return Response.json({
        messageId: result.messageId,
        conversationId: conversation.id,
      });
    }

    const result = await sendTemplate({
      organizationId: session.organizationId,
      conversationId: conversation.id,
      templateId: body.data.templateId,
      variables: body.data.variables,
    });
    return Response.json({
      messageId: result.messageId,
      conversationId: conversation.id,
    });
  } catch (err) {
    if (err instanceof TemplateError) {
      return apiError(templateErrorStatus(err), err.code, err.message);
    }
    if (err instanceof SendError) {
      return apiError(409, err.code, err.message);
    }
    throw err;
  }
});
