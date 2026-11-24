# Agentes Digital — configuração comercial

Este fork adapta o Vocero CRM ao processo comercial da Agentes Digital. A
instância começa em **TESTE**. Não usar contactos, pagamentos ou canais reais
até que o responsável altere explicitamente o modo de operação.

## Processo de venda

O processo é feito diretamente por mensagem, sem marcar reuniões. O agente deve
entender a necessidade antes de recomendar uma solução, registar no CRM as
informações fornecidas e encaminhar para uma pessoa qualquer condição que não
esteja aprovada. Não deve declarar uma venda ganha nem confirmar pagamentos; a
verificação financeira cabe à equipa.

Etapas comerciais: Identificado → Abordado → Respondeu → Qualificação →
Qualificado → Diagnóstico concluído → Oferta recomendada → Proposta enviada →
Dúvidas e decisão → Aguarda pagamento. Depois da confirmação humana seguem-se
Ganho, Onboarding, Homologação, Go-live e acompanhamento do cliente. “Sem
resposta”, “Nutrição”, “Descartado” e “Perdido” são saídas alternativas.

## Ofertas registadas na especificação

| Oferta | Implementação | Mensalidade |
|---|---:|---:|
| PRESENÇA | 125.000 Kz | 20.000 Kz |
| PROFISSIONAL | 250.000 Kz | 50.000 Kz |
| AUTORIDADE | 450.000 Kz | 85.000 Kz |
| DOMÍNIO IA | 700.000 Kz | 150.000 Kz |
| AUTOMATE PRO | 300.000 Kz | 65.000 Kz |

AUTOMATE PRO inclui quatro horas mensais. Diagnosticar primeiro e recomendar
uma oferta; apresentar uma segunda opção apenas quando houver uma dúvida real
de adequação. Não inventar funcionalidades, prazos, custos de terceiros,
garantias, reembolsos, duração contratual, validade de proposta ou métodos de
pagamento; confirmar esses pontos com o responsável.

## Modo e integrações

`AGENTES_DIGITAL_MODE` aceita `teste` ou `producao` e assume `teste` quando
ausente. O modo `teste` bloqueia mensagens de saída e reconhece webhooks sem
guardar dados de clientes. As conversas de demonstração usam identidades
sintéticas, não têm telefone e nunca podem ser enviadas. `producao` é uma
ativação de implantação que exige autorização operacional explícita.

O padrão monetário é AOA (Kwanza angolano) e o fuso horário é Africa/Luanda.

O CRM usa PostgreSQL através de `DATABASE_URL`; para esta implantação, Supabase
pode fornecer esse PostgreSQL. Ligar um agente ao Supabase ou ao Airtable no
Marketplace não configura automaticamente a aplicação. O Airtable não está
integrado neste código; não sincronizar nem tratá-lo como fonte oficial até
implementar e documentar essa ligação.

As migrações e os dados de produção do Supabase não são alterados por este fork.
Rever e aplicar migrações separadamente num ambiente de teste antes de qualquer
implantação.
