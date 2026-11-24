import { eq, inArray } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { RESPUESTAS_DEMO } from "@/server/quick-replies";

/**
 * Demonstração Agentes Digital: contactos e conversas fictícios para TESTE.
 * Idempotente: borra los datos demo previos de la organización (scoped por
 * los identificadores de teste demo) y reinserta. El KB queda lleno EXCEPTO garantías y
 * devoluciones — hueco INTENCIONAL para que el Laboratorio encuentre algo
 * real en la primera corrida.
 */

type Db = ReturnType<typeof getDb>;

const HOURS = 60 * 60 * 1000;

const DEMO_CONTACTS: {
  identity: string;
  phone: string | null;
  name: string;
  notes?: string;
  stage: string;
  thread: { dir: "in" | "out"; text: string; hoursAgo: number; ai?: boolean }[];
}[] = [
  {
    identity: "demo.agentesdigital.001",
    phone: null,
    name: "Marta Silva (teste)",
    stage: "Diagnóstico concluído",
    notes: "Exemplo fictício: quer responder mais depressa aos contactos de WhatsApp.",
    thread: [
      { dir: "in", text: "Bom dia. Recebo muitas mensagens e perco alguns pedidos.", hoursAgo: 5 },
      { dir: "out", text: "Olá, Marta. Em que canal recebe mais contactos e como os acompanha hoje?", hoursAgo: 5, ai: true },
      { dir: "in", text: "Principalmente no WhatsApp. Somos uma equipa pequena.", hoursAgo: 4 },
      { dir: "out", text: "Entendi. Vou registar o cenário e indicar a opção mais adequada depois de perceber o fluxo atual.", hoursAgo: 4, ai: true },
    ],
  },
  {
    identity: "demo.agentesdigital.002",
    phone: null,
    name: "Paulo Manuel (teste)",
    stage: "Oferta recomendada",
    notes: "Exemplo fictício para demonstrar recomendação com preços em Kz.",
    thread: [
      { dir: "in", text: "Quanto custa o AUTOMATE PRO?", hoursAgo: 8 },
      { dir: "out", text: "A implementação é 300.000 Kz e a mensalidade é 65.000 Kz. Inclui quatro horas mensais.", hoursAgo: 8, ai: true },
      { dir: "in", text: "Quero avançar. Como pago?", hoursAgo: 7 },
      { dir: "out", text: "Vou pedir à equipa que confirme os métodos de pagamento e os próximos passos consigo.", hoursAgo: 7, ai: true },
    ],
  },
  {
    identity: "demo.agentesdigital.003",
    phone: null,
    name: "Helena Gomes (teste)",
    stage: "Proposta enviada",
    notes: "Exemplo fictício; condições não definidas ficam pendentes de validação humana.",
    thread: [
      { dir: "in", text: "Preciso de uma solução para melhorar a presença digital da empresa.", hoursAgo: 12 },
      { dir: "out", text: "Posso ajudar. O que pretende melhorar primeiro: a apresentação da empresa, a captação de contactos ou o atendimento?", hoursAgo: 12, ai: true },
      { dir: "in", text: "A apresentação e os pedidos de contacto.", hoursAgo: 11 },
      { dir: "out", text: "Registei as prioridades e vou encaminhar uma proposta para validação da equipa.", hoursAgo: 11, ai: true },
    ],
  },
  {
    identity: "demo.agentesdigital.004",
    phone: null,
    name: "Carlos António (teste)",
    stage: "Qualificação",
    thread: [
      { dir: "in", text: "Queria saber se conseguem integrar com o sistema que usamos.", hoursAgo: 2 },
      { dir: "out", text: "Qual é o sistema e que informação precisa de circular entre as ferramentas?", hoursAgo: 2, ai: true },
    ],
  },
];
const DEMO_KB: { kind: "qa" | "block"; question?: string; answer?: string; content?: string }[] = [
  {
    kind: "block",
    content: "Agentes Digital ajuda empresas a melhorar a presença digital, automatizar tarefas e organizar o atendimento. Este conjunto de contactos e conversas é inteiramente fictício e serve apenas para demonstração em TESTE.",
  },
  {
    kind: "block",
    content: "Ofertas (implementação / mensalidade): PRESENÇA 125.000 / 20.000 Kz; PROFISSIONAL 250.000 / 50.000 Kz; AUTORIDADE 450.000 / 85.000 Kz; DOMÍNIO IA 700.000 / 150.000 Kz; AUTOMATE PRO 300.000 / 65.000 Kz. AUTOMATE PRO inclui quatro horas mensais.",
  },
  { kind: "qa", question: "Qual é o preço do AUTOMATE PRO?", answer: "A implementação custa 300.000 Kz e a mensalidade é 65.000 Kz. Inclui quatro horas mensais." },
  { kind: "qa", question: "Como escolho uma oferta?", answer: "A equipa começa por compreender as necessidades e recomenda a opção adequada. Pode apresentar uma segunda alternativa quando houver dúvida real de adequação." },
  { kind: "qa", question: "Posso marcar uma reunião?", answer: "O processo comercial é feito diretamente por mensagem, sem agendamento." },
  { kind: "qa", question: "Que métodos de pagamento aceitam?", answer: "Os métodos aceites ainda precisam de confirmação pela equipa. Não envie dados de pagamento antes de receber instruções oficiais." },
  { kind: "qa", question: "Quais são os prazos, garantias e condições de reembolso?", answer: "Essas condições não estão definidas nesta demonstração. Vou encaminhar a pergunta para a equipa." },
];
export async function seedDemo(
  db: Db,
  organizationId: string
): Promise<{ contacts: number; kbEntries: number }> {
  const demoIdentities = DEMO_CONTACTS.map((c) => c.identity);

  // --- Idempotencia: limpiar datos demo previos (orden inverso de FKs) ---
  const prevContacts = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(inArray(schema.contact.waIdentity, demoIdentities));
  const prevIds = prevContacts.map((c) => c.id);
  if (prevIds.length > 0) {
    const prevConvs = await db
      .select({ id: schema.conversation.id })
      .from(schema.conversation)
      .where(inArray(schema.conversation.contactId, prevIds));
    const convIds = prevConvs.map((c) => c.id);
    if (convIds.length > 0) {
      await db
        .delete(schema.message)
        .where(inArray(schema.message.conversationId, convIds));
      await db
        .delete(schema.conversation)
        .where(inArray(schema.conversation.id, convIds));
    }
    await db.delete(schema.lead).where(inArray(schema.lead.contactId, prevIds));
    await db.delete(schema.contact).where(inArray(schema.contact.id, prevIds));
  }
  // KB y corridas demo previas
  await db
    .delete(schema.kbEntry)
    .where(eq(schema.kbEntry.organizationId, organizationId));
  await db
    .delete(schema.agentTestCase)
    .where(eq(schema.agentTestCase.organizationId, organizationId));
  await db
    .delete(schema.agentTestRun)
    .where(eq(schema.agentTestRun.organizationId, organizationId));

  // --- Etapas (por nombre) ---
  const stages = await db
    .select()
    .from(schema.pipelineStage)
    .where(eq(schema.pipelineStage.organizationId, organizationId));
  const stageByName = new Map(stages.map((s) => [s.name, s.id]));
  const fallbackStage = stages[0]?.id;
  if (!fallbackStage) throw new Error("La organización no tiene etapas");

  // --- Contactos + conversaciones + mensajes + leads ---
  const now = Date.now();
  let position = 0;
  for (const demo of DEMO_CONTACTS) {
    const contactId = newId("contact");
    await db.insert(schema.contact).values({
      id: contactId,
      organizationId,
      phone: demo.phone,
      waIdentity: demo.identity,
      name: demo.name,
      notes: demo.notes ?? null,
    });

    const lastInbound = demo.thread
      .filter((t) => t.dir === "in")
      .reduce((min, t) => Math.min(min, t.hoursAgo), Infinity);
    const lastMessage = demo.thread.reduce(
      (min, t) => Math.min(min, t.hoursAgo),
      Infinity
    );

    const conversationId = newId("conversation");
    await db.insert(schema.conversation).values({
      id: conversationId,
      organizationId,
      contactId,
      isTest: true,
      lastInboundAt: new Date(now - lastInbound * HOURS),
      lastMessageAt: new Date(now - lastMessage * HOURS),
      unreadCount: demo.thread[demo.thread.length - 1]?.dir === "in" ? 1 : 0,
    });

    for (const msg of demo.thread) {
      const at = new Date(now - msg.hoursAgo * HOURS);
      await db.insert(schema.message).values({
        id: newId("message"),
        organizationId,
        conversationId,
        waMessageId: `wamid.demo.${newId("message")}`,
        direction: msg.dir,
        type: "text",
        text: msg.text,
        status: msg.dir === "in" ? "delivered" : "read",
        aiGenerated: msg.ai ?? false,
        origin: msg.ai ? "ai" : "operator",
        waTimestamp: at,
        createdAt: at,
      });
    }

    await db.insert(schema.lead).values({
      id: newId("lead"),
      organizationId,
      contactId,
      stageId: stageByName.get(demo.stage) ?? fallbackStage,
      position: position++,
      lastActivityAt: new Date(now - lastMessage * HOURS),
    });
  }

  // --- Knowledge base (con el hueco intencional) ---
  for (const entry of DEMO_KB) {
    await db.insert(schema.kbEntry).values({
      id: newId("kbEntry"),
      organizationId,
      kind: entry.kind,
      question: entry.question ?? null,
      answer: entry.answer ?? null,
      content: entry.content ?? null,
    });
  }

  // --- Comportamiento del agente de la demo ---
  await db
    .update(schema.agentProfile)
    .set({
      name: "Assistente Agentes Digital",
      tone: "Profissional, claro e próximo; português de Angola.",
      instructions: "Atende em modo TESTE. Diagnostica primeiro, recomenda uma oferta com base nas necessidades e não marca reuniões. Não inventa condições comerciais nem confirma pagamentos. Encaminha comprovativos e dúvidas não documentadas para uma pessoa.",
      escalationRules: "Escala para uma pessoa se o cliente o pedir, apresentar uma reclamação ou perguntar por uma condição comercial não documentada.",
      greeting: "Olá! Sou o assistente da Agentes Digital. Como posso ajudar?",
      updatedAt: new Date(),
    })
    .where(eq(schema.agentProfile.organizationId, organizationId));

  // --- Corrida de Laboratorio de ejemplo (guardada, con el hueco encontrado) ---
  const runId = newId("testRun");
  await db.insert(schema.agentTestRun).values({
    id: runId,
    organizationId,
    status: "done",
    score: 83,
    startedAt: new Date(now - 24 * HOURS),
    finishedAt: new Date(now - 24 * HOURS + 3 * 60 * 1000),
  });
  const exampleCases: {
    persona: string;
    veredicto: "verde" | "amarillo" | "rojo";
    hallazgos: unknown[];
    transcript: { role: string; text: string }[];
  }[] = [
    {
      persona: "comprador_decidido",
      veredicto: "verde",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "Quero melhorar o atendimento pelo WhatsApp. Quanto custa o AUTOMATE PRO?" },
        { role: "agente", text: "A implementação custa 300.000 Kz e a mensalidade é 65.000 Kz. Inclui quatro horas mensais." },
        { role: "cliente", text: "Quero avançar. Como pago?" },
        { role: "agente", text: "Vou encaminhar o pedido para a equipa confirmar os métodos de pagamento e os próximos passos." },
      ],
    },
    {
      persona: "pregunton_precios",
      veredicto: "verde",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "Quais são os preços?" },
        { role: "agente", text: "A implementação e a mensalidade variam por oferta. O que pretende resolver primeiro no seu negócio?" },
      ],
    },
    {
      persona: "cliente_enojado",
      veredicto: "amarillo",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "Estou insatisfeito com o serviço." },
        { role: "agente", text: "Lamento a situação. Vou encaminhar a conversa para uma pessoa da equipa acompanhar o seu caso." },
      ],
    },
    {
      persona: "fuera_de_kb",
      veredicto: "verde",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "Qual é a política de reembolso?" },
        { role: "agente", text: "Essa condição não está documentada. Vou confirmar com a equipa antes de lhe responder." },
      ],
    },
    {
      persona: "pide_humano",
      veredicto: "verde",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "Prefiro falar com uma pessoa." },
        { role: "agente", text: "Claro. Vou encaminhar a conversa para a equipa." },
      ],
    },
    {
      persona: "errores_modismos",
      veredicto: "verde",
      hallazgos: [],
      transcript: [
        { role: "cliente", text: "Ya, quero pôr o atendimento a andar melhor." },
        { role: "agente", text: "Percebi. Como é que a sua equipa recebe e acompanha os pedidos hoje?" },
      ],
    },
  ];  for (const c of exampleCases) {
    await db.insert(schema.agentTestCase).values({
      id: newId("testCase"),
      organizationId,
      runId,
      persona: c.persona,
      status: "done",
      veredicto: c.veredicto,
      hallazgos: c.hallazgos,
      transcript: c.transcript,
    });
  }

  // 049 — Cuatro respuestas rápidas para probar el «/» del compositor. No
  // pisa ni duplica las que el negocio ya tenga con el mismo atajo.
  await db
    .insert(schema.quickReply)
    .values(RESPUESTAS_DEMO.map((r) => ({ id: newId("quickReply"), organizationId, ...r })))
    .onConflictDoNothing({ target: [schema.quickReply.organizationId, schema.quickReply.atajo] });

  return { contacts: DEMO_CONTACTS.length, kbEntries: DEMO_KB.length };
}

/** true si la organización aún no tiene datos de dominio (para el botón). */
export async function isDomainEmpty(
  db: Db,
  organizationId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(eq(schema.contact.organizationId, organizationId))
    .limit(1);
  return rows.length === 0;
}
