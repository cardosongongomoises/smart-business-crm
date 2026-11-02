/**
 * Traduce el error de envío de Meta a algo que el operador pueda ACCIONAR.
 *
 * Meta manda el motivo en inglés y en jerga propia ("User's number is part of
 * an experiment"), y el CRM lo guardaba sin mostrarlo: el mensaje fallido solo
 * enseñaba un triángulo mudo. Aquí se convierte en una frase que dice qué
 * pasó y qué hacer, conservando el código para poder rastrearlo en la
 * documentación de Meta.
 */

const DESCRIPTIONS: Record<number, string> = {
  130472:
    "A Meta incluiu o número do destinatário numa experiência e está a bloquear mensagens de MARKETING. Não é um problema da sua configuração: experimente um modelo da categoria UTILITY ou outro número.",
  131049:
    "A Meta limitou as mensagens de marketing para este utilizador, para proteger a qualidade do ecossistema. Aguarde ou use um modelo da categoria UTILITY.",
  131047:
    "Passaram mais de 24 h desde a última mensagem do cliente: só é possível reabrir com um modelo aprovado.",
  131048:
    "A Meta interrompeu o envio devido ao limite de spam do seu número. Reduza o ritmo de envios e reveja a qualidade do número.",
  131026:
    "O destinatário não pode receber mensagens do WhatsApp (número inexistente, sem conta ou que não aceita mensagens de empresas).",
  131031:
    "A sua conta do WhatsApp Business está bloqueada ou restringida pela Meta. Reveja no Gestor do WhatsApp.",
  131030:
    "O número do destinatário não está na lista de permitidos da sua aplicação em modo de teste.",
  130429:
    "Ultrapassou o limite de mensagens por segundo da Meta. Tente novamente dentro de alguns instantes.",
  132000:
    "O modelo e os parâmetros enviados não coincidem (faltam ou sobram variáveis).",
  132001:
    "A Meta não encontra esse modelo nesse idioma. Sincronize os modelos e confirme que continua aprovado.",
  132005:
    "O texto traduzido do modelo ultrapassa o limite de caracteres da Meta.",
  132007:
    "O conteúdo do modelo viola as políticas da Meta.",
  132012:
    "Os parâmetros do modelo não respeitam o formato esperado pela Meta.",
  132015:
    "O modelo está pausado devido à baixa qualidade: a Meta não permite o envio até recuperar.",
  132016:
    "O modelo foi desativado por motivos de qualidade e já não pode ser enviado.",
  133010: "O número não está registado na Cloud API.",
  368: "O número está temporariamente bloqueado por infringir as políticas da Meta.",
};

/**
 * @param code   Código numérico de Meta (`errors[0].code`), si vino.
 * @param detail Texto crudo de Meta, como respaldo cuando el código es nuevo.
 */
export function describeSendError(
  code: number | null | undefined,
  _detail?: string | null
): string {
  const known = code != null ? DESCRIPTIONS[code] : undefined;
  // `||` y no `??`: Meta a veces manda el texto vacío o en blanco, y un
  // mensaje de error vacío es tan inútil como el triángulo mudo.
  const base = known || "A Meta rejeitou o envio";
  return code != null ? `${base} (Meta ${code})` : base;
}
