/**
 * 034 — Roles como datos.
 *
 * Un rol es lo que hace el agente: instrucciones, herramientas encendidas y
 * las personas con que el Laboratorio lo prueba. El runtime es uno y vive en
 * el cerebro; lo que cambia de un negocio a otro vive aquí y en el perfil, y
 * viaja por `GET /api/bot/profile`. Encender o apagar una herramienta es
 * editar el perfil, sin redesplegar nada.
 *
 * Puro y sin dependencias del servidor: lo usan la API, la pantalla Agente y
 * el Laboratorio.
 */

export type ClaveHerramienta =
  | "ficha"
  | "etapa"
  | "agendar"
  | "reprogramar"
  | "salida"
  | "escalar";

export type Herramienta = {
  clave: ClaveHerramienta;
  etiqueta: string;
  descripcion: string;
  /** Solo existe con la bandera `AGENDA` encendida. */
  agenda?: true;
  /** Red de seguridad: no se apaga (spec 034, D2). */
  fija?: true;
};

/** El catálogo. Las claves son contrato con el cerebro: no se renombran. */
export const HERRAMIENTAS: readonly Herramienta[] = [
  {
    clave: "ficha",
    etiqueta: "Preencher a ficha",
    descripcion:
      "Regista o que descobre sobre o cliente na respetiva ficha do CRM.",
  },
  {
    // 038 — Solo hacia adelante y entre etapas abiertas: ganar o perder un
    // trato lo decide una persona.
    clave: "etapa",
    etiqueta: "Mover de etapa",
    descripcion:
      "Avança o lead no funil quando a conversa o justifica. Nunca o dá como ganho nem como perdido.",
  },
  {
    clave: "agendar",
    etiqueta: "Agendar marcações",
    descripcion: "Apresenta horários reais da agenda e reserva o que o cliente escolher.",
    agenda: true,
  },
  {
    clave: "reprogramar",
    etiqueta: "Remarcar marcações",
    descripcion: "Move uma marcação já agendada para outro horário disponível.",
    agenda: true,
  },
  {
    clave: "salida",
    etiqueta: "Finalização cortês",
    descripcion: "Despede-se com simpatia de quem não qualifica, sugerindo recursos quando existirem.",
  },
  {
    clave: "escalar",
    etiqueta: "Transferir para uma pessoa",
    descripcion:
      "Quando o cliente pede, perante hostilidade ou dúvidas que não sabe responder. Sempre ativa.",
    fija: true,
  },
];

export const CLAVES_HERRAMIENTA: readonly ClaveHerramienta[] = HERRAMIENTAS.map(
  (h) => h.clave
);

export function esClaveHerramienta(valor: unknown): valor is ClaveHerramienta {
  return typeof valor === "string" && (CLAVES_HERRAMIENTA as string[]).includes(valor);
}

/**
 * Las herramientas encendidas de un perfil: `null` = todas (lo que tiene una
 * instalación que actualiza). `escalar` siempre va, y en el orden del
 * catálogo. Lo que no es del catálogo se ignora.
 */
export function herramientasEfectivas(
  tools: readonly string[] | null | undefined
): ClaveHerramienta[] {
  if (!tools) return [...CLAVES_HERRAMIENTA];
  const encendidas = new Set(tools.filter(esClaveHerramienta));
  return HERRAMIENTAS.filter((h) => h.fija || encendidas.has(h.clave)).map((h) => h.clave);
}

export type ClaveRol = "calificador";

export type Rol = {
  clave: ClaveRol;
  etiqueta: string;
  descripcion: string;
  instrucciones: string;
  reglasDeEscalado: string;
  herramientas: readonly ClaveHerramienta[];
  /** Claves de las personas del Laboratorio (`src/server/lab/personas.ts`). */
  personas: readonly string[];
};

/** Los roles. En 2.0, uno: el Calificador (spec 034, D7). */
export const ROLES: Record<ClaveRol, Rol> = {
  calificador: {
    clave: "calificador",
    etiqueta: "Qualificador",
    descripcion:
      "Atende quem contacta, compreende as necessidades, qualifica o lead e agenda com a equipa quando aplicável.",
    instrucciones: [
      "Atende as pessoas que escrevem para o negócio. O seu trabalho:",
      "1. Compreender o que cada pessoa necessita, fazendo uma pergunta de cada vez.",
      "2. Responder com base no conhecimento do negócio; se algo não estiver indicado, não invente: ofereça transferir a dúvida para a equipa.",
      "3. Qualificar o contacto: anote na ficha os dados recolhidos (o que procura, para quando, orçamento se indicar).",
      "4. Se qualificar, ofereça uma marcação com a equipa. Se não, despeça-se com simpatia e partilhe recursos caso existam.",
    ].join("\n"),
    reglasDeEscalado:
      "Transfira a conversa para uma pessoa se o cliente o solicitar, se demonstrar hostilidade, em caso de reclamação sobre uma compra, ou se questionar algo relevante que a base de conhecimento não cubra.",
    herramientas: CLAVES_HERRAMIENTA,
    personas: [
      "comprador_decidido",
      "pregunton_precios",
      "cliente_enojado",
      "hostil",
      "fuera_de_kb",
      "pide_humano",
      "errores_modismos",
      "sin_rumbo",
    ],
  },
};

export function esClaveRol(valor: unknown): valor is ClaveRol {
  return typeof valor === "string" && valor in ROLES;
}

/** El rol de un perfil; uno que ya no exista cae al Calificador. */
export function rolDe(role: string | null | undefined): Rol {
  return esClaveRol(role) ? ROLES[role] : ROLES.calificador;
}
