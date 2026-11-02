import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { getOrCreateContactByIdentity } from "@/server/inbox/identity";
import { getOrCreateConversation, serializeMessage } from "@/server/inbox/ingest";
import { onLeadActivity } from "@/server/inbox/lead-activity";
import { publish } from "@/server/events/bus";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body.phone || body.numero || body.from || "").replace(/\D/g, "");
    if (!phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    const name = String(body.name || body.nome || phone).trim();
    const incomingText = body.incomingText || body.text || body.message || null;
    const responseText = body.responseText || body.response || body.output || null;

    const db = getDb();

    // 1. Obter organização ativa
    const orgs = await db.select().from(schema.organization).limit(1);
    const org = orgs[0];
    if (!org) {
      return NextResponse.json({ error: "organization not found" }, { status: 500 });
    }
    const organizationId = org.id;

    // 2. Criar ou obter contato
    const { contact } = await getOrCreateContactByIdentity(organizationId, {
      identity: phone,
      channel: "whatsapp",
      phone,
      waUserId: null,
      profileName: name !== phone ? name : null,
    });

    // 3. Criar ou obter conversa
    const conversation = await getOrCreateConversation(organizationId, contact.id, {
      channel: "whatsapp",
    });

    const now = new Date();
    let savedInMessage = null;
    let savedOutMessage = null;

    // 4. Salvar mensagem do cliente se fornecida
    if (incomingText) {
      const [msgIn] = await db
        .insert(schema.message)
        .values({
          id: newId("message"),
          organizationId,
          conversationId: conversation.id,
          direction: "in",
          type: "text",
          text: String(incomingText),
          status: "delivered",
          origin: "manual",
          createdAt: now,
          waTimestamp: now,
        })
        .returning();

      savedInMessage = msgIn;
      publish(organizationId, {
        type: "message.new",
        data: {
          conversationId: conversation.id,
          message: serializeMessage(msgIn, null, null),
        },
      });
    }

    // 5. Salvar resposta do Agente IA se fornecida
    if (responseText) {
      const afterNow = new Date(now.getTime() + 1000);
      const [msgOut] = await db
        .insert(schema.message)
        .values({
          id: newId("message"),
          organizationId,
          conversationId: conversation.id,
          direction: "out",
          type: "text",
          text: String(responseText),
          status: "sent",
          aiGenerated: true,
          origin: "ai",
          createdAt: afterNow,
          waTimestamp: afterNow,
        })
        .returning();

      savedOutMessage = msgOut;
      publish(organizationId, {
        type: "message.new",
        data: {
          conversationId: conversation.id,
          message: serializeMessage(msgOut, null, null),
        },
      });
    }

    // 6. Atualizar última mensagem na conversa
    await db
      .update(schema.conversation)
      .set({
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.conversation.id, conversation.id));

    publish(organizationId, {
      type: "conversation.updated",
      data: { conversation: { id: conversation.id } },
    });

    // 7. Atualizar ou criar Lead no Kanban Pipeline
    await onLeadActivity(organizationId, contact.id, now);

    return NextResponse.json({
      success: true,
      contactId: contact.id,
      conversationId: conversation.id,
      inMessageId: savedInMessage?.id || null,
      outMessageId: savedOutMessage?.id || null,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    console.error("[sync/whatsapp] error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
