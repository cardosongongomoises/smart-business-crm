import type { Channel } from "@/lib/channels";
import { zernioFetch } from "@/server/zernio";

/**
 * 023 — Qué cuenta de Zernio es la que se está conectando, y cómo está.
 *
 * En el panel de Zernio hay DOS ids que parecen iguales: el del **perfil** (el
 * contenedor, que agrupa Instagram, Facebook y TikTok) y el de cada
 * **cuenta**. Los webhooks enrutan por el de la cuenta. Quien guardaba el del
 * perfil veía el webhook responder 200 y cada mensaje descartado en silencio
 * con «accountId desconocido».
 *
 * Por eso el id capturado ya no se guarda a ciegas: se resuelve contra las
 * cuentas reales de esa llave. De paso, quien tiene una sola cuenta del canal
 * no tiene que copiar ningún id.
 */

/** Los canales que llegan por Zernio. */
export type ZernioChannel = Exclude<Channel, "whatsapp">;

/** Cómo llama Zernio a la plataforma de cada canal. */
export const ZERNIO_PLATFORMS: Record<ZernioChannel, readonly string[]> = {
  instagram: ["instagram"],
  messenger: ["facebook", "messenger"],
  tiktok: ["tiktok"],
};

/** Una cuenta de `GET /accounts`, en lo que a Vocero le importa. */
export type ZernioAccount = {
  _id: string;
  platform?: string | null;
  username?: string | null;
  displayName?: string | null;
  /** En Instagram, el id con el que Meta identifica al perfil. */
  platformUserId?: string | null;
  isActive?: boolean;
  enabled?: boolean;
  needsReconnection?: boolean;
  platformStatus?: string | null;
  platformStatusReason?: string | null;
  tokenExpiresAt?: string | null;
  messagingRestriction?: unknown;
  /** Solo TikTok: `business` o `personal`. */
  tiktokAccountType?: string | null;
  profileId?: string | { _id?: string } | null;
  metadata?: {
    selectedPageId?: string | null;
    selectedPageName?: string | null;
  } | null;
};

export type ZernioCandidate = { id: string; name: string };

export type PickResult =
  | { ok: true; account: ZernioAccount }
  | {
      ok: false;
      code: "choose_account" | "unknown_account";
      message: string;
      candidates: ZernioCandidate[];
    };

function profileIdOf(a: ZernioAccount): string | null {
  const p = a.profileId;
  if (!p) return null;
  return typeof p === "string" ? p : (p._id ?? null);
}

/** El nombre con el que una persona reconoce la cuenta. */
export function zernioAccountName(a: ZernioAccount): string {
  const pagina = a.metadata?.selectedPageName?.trim();
  if (pagina) return pagina;
  const usuario = a.username?.trim().replace(/^@/, "");
  const platform = (a.platform ?? "").toLowerCase();
  if (usuario && platform !== "facebook") return `@${usuario}`;
  return a.displayName?.trim() || usuario || a._id;
}

// Una agencia puede tener decenas de cuentas en una llave: la lista que se le
// enseña a quien conecta se corta, y el mensaje lo dice.
const MAX_CANDIDATES = 8;

/** Puro: decide la cuenta que corresponde a lo capturado (tabla D1 de la spec). */
export function pickZernioAccount(
  accounts: readonly ZernioAccount[],
  ref: string | null | undefined,
  channel: ZernioChannel
): PickResult {
  const platforms = ZERNIO_PLATFORMS[channel];
  const delCanal = accounts.filter((a) =>
    platforms.includes((a.platform ?? "").toLowerCase())
  );
  const candidates = delCanal
    .slice(0, MAX_CANDIDATES)
    .map((a) => ({ id: a._id, name: zernioAccountName(a) }));
  const cuales =
    candidates.map((c) => `${c.name} (${c.id})`).join(", ") +
    (delCanal.length > MAX_CANDIDATES ? ` y ${delCanal.length - MAX_CANDIDATES} más` : "");

  if (delCanal.length === 0) {
    return {
      ok: false,
      code: "unknown_account",
      message:
        "Essa chave do Zernio não tem nenhuma conta ligada deste canal. Ligue-a no Zernio e tente novamente.",
      candidates,
    };
  }

  const id = ref?.trim() ?? "";
  if (!id) {
    if (delCanal.length === 1) return { ok: true, account: delCanal[0]! };
    return {
      ok: false,
      code: "choose_account",
      message: `Esta chave tem ${delCanal.length} contas deste canal. Escolha a que pretende ligar.`,
      candidates,
    };
  }

  const exacta = accounts.find((a) => a._id === id);
  if (exacta) {
    if (delCanal.includes(exacta)) return { ok: true, account: exacta };
    return {
      ok: false,
      code: "unknown_account",
      message: `Este ID pertence a uma conta de ${exacta.platform ?? "outra rede"}, não deste canal. Contas válidas: ${cuales}`,
      candidates,
    };
  }

  // Se pegó el id del PERFIL: vale si en ese perfil hay UNA cuenta del canal.
  const delPerfil = delCanal.filter((a) => profileIdOf(a) === id);
  if (delPerfil.length === 1) return { ok: true, account: delPerfil[0]! };

  return {
    ok: false,
    code: "unknown_account",
    message: `Esse id não pertence a nenhuma conta deste canal no Zernio. Válidas: ${cuales}`,
    candidates,
  };
}

export type Health = { level: "ok" | "warn" | "error"; message: string };

/**
 * Puro: cómo está la cuenta según Zernio. `null` es «ya no aparece entre las
 * cuentas de esa llave»: se desvinculó en Zernio o la llave es de otra cuenta.
 */
export function accountHealth(
  account: ZernioAccount | null | undefined,
  channel: ZernioChannel,
  now: Date = new Date()
): Health {
  if (!account) {
    return {
      level: "error",
      message: "A conta já não aparece no Zernio com essa chave. Ligue-a novamente.",
    };
  }
  if (account.needsReconnection) {
    return { level: "error", message: "O Zernio pede para ligar novamente a conta." };
  }
  if (account.isActive === false || account.enabled === false) {
    return { level: "error", message: "A conta está desactivada no Zernio." };
  }
  if (account.messagingRestriction) {
    return {
      level: "error",
      message: "A plataforma restringiu as mensagens desta conta.",
    };
  }
  if (
    channel === "tiktok" &&
    account.tiktokAccountType &&
    account.tiktokAccountType.toLowerCase() !== "business"
  ) {
    return {
      level: "error",
      message:
        "É uma conta pessoal: o TikTok só entrega mensagens de contas Business.",
    };
  }
  const estado = account.platformStatus?.toLowerCase();
  if (estado && estado !== "active") {
    const motivo = account.platformStatusReason?.trim();
    return {
      level: "warn",
      message: `A plataforma comunica-a como «${account.platformStatus}»${motivo ? `: ${motivo}` : ""}.`,
    };
  }
  const vence = account.tokenExpiresAt ? Date.parse(account.tokenExpiresAt) : NaN;
  if (Number.isFinite(vence) && vence < now.getTime()) {
    return {
      level: "warn",
      message: "O acesso do Zernio à conta expirou. Se deixar de receber mensagens, ligue-a novamente no Zernio.",
    };
  }
  return { level: "ok", message: "Ativa" };
}

/**
 * Las cuentas de esa llave. Lanza `MetaApiError` (401 = llave inválida, 0 o
 * 5xx = Zernio no responde), igual que el resto del transporte.
 */
export async function fetchZernioAccounts(token: string): Promise<ZernioAccount[]> {
  const json = (await zernioFetch("/accounts", { token, timeoutMs: 10_000 })) as {
    accounts?: ZernioAccount[];
  } | null;
  return Array.isArray(json?.accounts) ? json.accounts : [];
}
