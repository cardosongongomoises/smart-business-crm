import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FR-031 / FR-082: una conversación de prueba del Laboratorio JAMÁS alcanza
 * la API de WhatsApp — sendText lanza antes de cualquier llamada Graph.
 */

const graphRequest = vi.fn();

vi.mock("@/lib/meta/client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/meta/client")>();
  return { ...original, graphRequest };
});

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "innerJoin", "where", "orderBy"]) {
    chain[m] = () => chain;
  }
  chain.limit = () => Promise.resolve(rows);
  return chain;
}

const selectRows: unknown[][] = [];

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => makeChain(selectRows.shift() ?? []),
  }),
  schema: {
    conversation: { contactId: "contactId", id: "id" },
    contact: { id: "id" },
    message: {},
  },
}));

describe("sandbox del Laboratorio en el sender", () => {
  beforeEach(() => {
    graphRequest.mockReset();
    selectRows.length = 0;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("conversación is_test → lanza sandbox_violation y NO llama a Graph", async () => {
    selectRows.push([
      {
        conversation: {
          id: "cv_test",
          organizationId: "org_1",
          isTest: true,
          lastInboundAt: new Date(),
        },
        contact: { id: "ct_1", phone: "5215511111111" },
      },
    ]);
    const { sendText, SendError } = await import("@/server/inbox/send");

    await expect(
      sendText({
        conversationId: "cv_test",
        organizationId: "org_1",
        text: "hola",
      })
    ).rejects.toMatchObject({ code: "sandbox_violation" });

    expect(graphRequest).not.toHaveBeenCalled();

    // sanity: el error es del tipo tipado
    try {
      selectRows.push([
        {
          conversation: {
            id: "cv_test",
            organizationId: "org_1",
            isTest: true,
            lastInboundAt: new Date(),
          },
          contact: { id: "ct_1", phone: "5215511111111" },
        },
      ]);
      await sendText({
        conversationId: "cv_test",
        organizationId: "org_1",
        text: "hola",
      });
    } catch (err) {
      expect(err).toBeInstanceOf(SendError);
    }
    expect(graphRequest).not.toHaveBeenCalled();
  });
  it("TESTE mode blocks regular conversations", async () => {
    vi.stubEnv("AGENTES_DIGITAL_MODE", "teste");
    selectRows.push([
      {
        conversation: {
          id: "cv_real",
          organizationId: "org_1",
          isTest: false,
          lastInboundAt: new Date(),
        },
        contact: { id: "ct_1", phone: "244900000001" },
      },
    ]);
    const { sendText } = await import("@/server/inbox/send");

    await expect(
      sendText({
        conversationId: "cv_real",
        organizationId: "org_1",
        text: "test message",
      })
    ).rejects.toMatchObject({ code: "sandbox_violation" });

    expect(graphRequest).not.toHaveBeenCalled();
  });
});
