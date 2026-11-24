# MCP do CRM para OpenBot

O CRM disponibiliza um endpoint MCP remoto em `POST /api/mcp`, usando Streamable HTTP. O endpoint reutiliza a autenticação de serviço `BOT_API_KEY`; configure a ligação no OpenBot com o URL público completo e o mesmo valor no cabeçalho `Authorization: Bearer <BOT_API_KEY>`.

## Ferramentas disponíveis

- `crm_get_agent_profile`: consulta o perfil comercial e a base de conhecimento.
- `crm_get_conversation_context`: consulta o contexto de uma conversa por `conversationId` ou a identidade do contacto.

As ferramentas são apenas de leitura. Não enviam mensagens, não alteram etapas e não escrevem dados no CRM. A chave continua validada pelo CRM e não é devolvida pelas ferramentas.

Depois de publicar uma versão que contenha `/api/mcp`, registe no OpenBot um servidor HTTP com endereço `https://<domínio-do-crm>/api/mcp` e cabeçalho Bearer. Em instalações sem `BOT_API_KEY`, o endpoint permanece fechado.
