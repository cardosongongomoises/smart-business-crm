import { GET as getBotContext } from "@/app/api/bot/context/route";
import { GET as getBotProfile } from "@/app/api/bot/profile/route";
import { requireBotKey } from "@/server/bot/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROTOCOL_VERSION = "2025-11-25";

type RpcRequest = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

const tools = [
  {
    name: "crm_get_agent_profile",
    title: "Consultar perfil comercial do CRM",
    description:
      "Lê o perfil do agente, as instruções e a base de conhecimento aprovadas no CRM. Não altera dados nem envia mensagens.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "crm_get_conversation_context",
    title: "Consultar contexto de uma conversa",
    description:
      "Lê o contexto CRM de uma conversa identificada por conversationId ou identity, incluindo etapa e estado de atendimento. Não envia mensagens.",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string", description: "ID da conversa no CRM." },
        identity: { type: "string", description: "Identidade do contacto, normalmente o telefone em formato internacional." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
];

function rpc(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

function withBotAuth(request: Request, url: string) {
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const apiKey = request.headers.get("x-api-key");
  if (authorization) headers.set("authorization", authorization);
  if (apiKey) headers.set("x-api-key", apiKey);
  return new Request(url, { headers });
}

async function callTool(request: Request, name: string, args: unknown) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Os argumentos da ferramenta devem ser um objeto.");
  }

  let response: Response;
  if (name === "crm_get_agent_profile") {
    response = await getBotProfile(withBotAuth(request, "http://crm.internal/api/bot/profile"));
  } else if (name === "crm_get_conversation_context") {
    const input = args as { conversationId?: unknown; identity?: unknown };
    const conversationId = typeof input.conversationId === "string" ? input.conversationId.trim() : "";
    const identity = typeof input.identity === "string" ? input.identity.trim() : "";
    if (!conversationId && !identity) throw new Error("Indica conversationId ou identity.");
    const query = new URLSearchParams(conversationId ? { conversationId } : { identity });
    response = await getBotContext(
      withBotAuth(request, `http://crm.internal/api/bot/context?${query.toString()}`),
    );
  } else {
    throw new Error("Ferramenta CRM desconhecida.");
  }

  const data: unknown = await response.json().catch(() => ({ error: "Resposta inválida do CRM." }));
  return { response, data };
}

export async function GET() {
  return new Response("MCP uses POST Streamable HTTP requests.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export async function POST(request: Request) {
  const denied = requireBotKey(request);
  if (denied) {
    return new Response(denied.body, {
      status: denied.status,
      headers: {
        ...Object.fromEntries(denied.headers.entries()),
        "WWW-Authenticate": 'Bearer realm="Vocero CRM MCP"',
      },
    });
  }

  let body: RpcRequest;
  try {
    body = (await request.json()) as RpcRequest;
  } catch {
    return rpcError(null, -32700, "Invalid JSON.");
  }

  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcError(body.id ?? null, -32600, "Invalid JSON-RPC request.");
  }

  // MCP notifications do not carry an id and must not receive a JSON-RPC reply.
  if (body.id === undefined && body.method.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }
  const id = body.id ?? null;
  const params = (body.params && typeof body.params === "object" ? body.params : {}) as Record<string, unknown>;

  if (body.method === "initialize") {
    return rpc(id, {
      protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "agentes-digital-crm", title: "CRM Agentes Digital", version: "1.0.0" },
      instructions: "CRM read-only. Consulta dados comerciais e contexto de conversas; não envia mensagens nem altera o CRM.",
    });
  }
  if (body.method === "ping") return rpc(id, {});
  if (body.method === "tools/list") return rpc(id, { tools });

  if (body.method === "tools/call") {
    const toolName = params.name;
    if (typeof toolName !== "string") return rpcError(id, -32602, "Tool name is required.");
    try {
      const { response, data } = await callTool(request, toolName, params.arguments ?? {});
      const text = JSON.stringify(data);
      return rpc(id, {
        content: [{ type: "text", text }],
        structuredContent: data,
        ...(response.ok ? {} : { isError: true }),
      });
    } catch (error) {
      return rpc(id, {
        content: [{ type: "text", text: error instanceof Error ? error.message : "Falha ao consultar o CRM." }],
        isError: true,
      });
    }
  }

  return rpcError(id, -32601, "Method not found.");
}
