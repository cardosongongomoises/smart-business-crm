import path from "node:path";
import postgres from "postgres";
import type { ZodIssue } from "zod";
import { getDb, PG_CONNECTION_OPTIONS, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { envSchema, safeParseEnv, type Env } from "@/lib/env";
import { leerConfigDespacho } from "@/server/brains/config";
import { GENERATED_SECRETS, PLACEHOLDER_PREFIX } from "@/server/doctor/init-env";
import { probeBucket, probeMediaDir } from "@/server/media-dir";
import { testConnection, type ConnectionCheck } from "@/server/whatsapp/connect";
import {
  getCredentialsByOrg,
  tokenLast4,
  type Credentials,
} from "@/server/whatsapp/credentials";

/**
 * `pnpm doctor` — las comprobaciones, una por línea, con el arreglo exacto de
 * cada ✗. Nada aquí imprime: devuelve resultados y el CLI (scripts/doctor.ts)
 * los formatea. Lo que toca red o disco recibe su sonda por parámetro para
 * poder probarse sin Postgres ni Meta.
 *
 * Regla de la casa (constitución I): jamás un secreto en la salida. De las
 * variables secretas solo se dice que están definidas y cuánto miden; de la
 * URL de la base, todo menos la contraseña; del token de WhatsApp, los
 * últimos 4 caracteres, como en la UI.
 */

export type CheckStatus = "ok" | "fail" | "warn" | "skip";

export type CheckResult = {
  status: CheckStatus;
  label: string;
  detail?: string;
  /** Comando o acción exacta para arreglarlo (en todo ✗ y en los avisos). */
  fix?: string;
};

/* ---------- Variables de entorno ---------- */

/**
 * Las variables que el arranque exige: las del esquema sin default ni
 * `.optional()`. Derivadas del esquema, no copiadas: si env.ts gana una
 * obligatoria, el doctor la confirme solo.
 */
export function requiredEnvKeys(): string[] {
  return Object.entries(envSchema.shape)
    .filter(([, type]) => !type.isOptional())
    .map(([key]) => key);
}

/** Variables cuyo valor jamás se imprime (ni entero ni en parte). */
const SECRET_KEYS = new Set<string>([
  ...Object.keys(GENERATED_SECRETS),
  "DATABASE_URL",
  "OPENROUTER_API_TOKEN",
  "META_APP_SECRET",
  "BOT_API_KEY",
]);

const FIX: Record<string, string> = {
  APP_BASE_URL:
    "no ficheiro .env: APP_BASE_URL=https://crm.tudominio.com (com docker compose nesta máquina: https://localhost)",
  DATABASE_URL:
    "no ficheiro .env: DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/vocero (docker compose) ou ...@localhost:5432/vocero (docker-compose.dev.yml)",
  DOMAIN:
    "no ficheiro .env: DOMAIN=crm.tudominio.com (ou localhost para testar aqui); só é usado pelo docker compose para o HTTPS do Caddy",
};

export function fixFor(key: string): string {
  if (key in GENERATED_SECRETS) {
    const { openssl } = GENERATED_SECRETS[key as keyof typeof GENERATED_SECRETS];
    const extra = key === "POSTGRES_PASSWORD" ? " (a mesma também em DATABASE_URL)" : "";
    return `gere um novo com: ${openssl} e coloque-o em .env${extra}; se ainda não existir .env, pnpm init-env gera todos`;
  }
  return FIX[key] ?? "consulte a descrição desta variável em .env.example";
}

/** `postgresql://usuario:***@host:puerto/base` — todo menos la contraseña. */
export function redactDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username || "?"}:***@${u.host}${u.pathname}`;
  } catch {
    return "(não foi possível interpretar como URL)";
  }
}

export function describeValue(key: string, value: string): string {
  if (key === "DATABASE_URL") return redactDatabaseUrl(value);
  if (SECRET_KEYS.has(key)) return `definida (${value.length} caracteres)`;
  return value;
}

/**
 * El mensaje de zod en español y sin el valor (zod no lo incluye, pero por si
 * acaso). Zod 4 ya no dice qué recibió: si em falta se sabe por `value`.
 */
export function translateIssue(issue: ZodIssue, value?: string): string {
  if (issue.path[0] === "ENCRYPTION_KEY") {
    return "deve conter 32 bytes codificados em base64";
  }
  switch (issue.code) {
    case "invalid_type":
      return value === undefined
        ? "em falta"
        : `tipo inválido (esperava-se ${issue.expected})`;
    case "invalid_format":
      return issue.format === "url"
        ? "não é um URL válido (deve começar por http:// ou https://)"
        : "formato inválido";
    case "too_small":
      return `tem de ter pelo menos ${issue.minimum} caracteres`;
    default:
      return "valor inválido";
  }
}

function hasPlaceholder(value: string | undefined): value is string {
  return typeof value === "string" && value.includes(PLACEHOLDER_PREFIX);
}

function checkVar(
  key: string,
  value: string | undefined,
  issue: ZodIssue | undefined,
  required: boolean
): CheckResult {
  if (hasPlaceholder(value)) {
    return {
      status: "fail",
      label: key,
      detail: `continua com o valor de exemplo (${PLACEHOLDER_PREFIX}…)`,
      fix: fixFor(key),
    };
  }
  if (issue) {
    return { status: "fail", label: key, detail: translateIssue(issue, value), fix: fixFor(key) };
  }
  const present = typeof value === "string" && value !== "";
  if (!present) {
    return required
      ? { status: "fail", label: key, detail: "em falta", fix: fixFor(key) }
      : { status: "skip", label: key, detail: "não definida (opcional)" };
  }
  return { status: "ok", label: key, detail: describeValue(key, value) };
}

export type EnvEvaluation = { results: CheckResult[]; env: Env | null };

/**
 * Pasa el entorno por el MISMO esquema que el arranque (safeParseEnv) y
 * devuelve una línea por variable obligatoria, más una por cada opcional que
 * tenga un problema (también tumban el arranque) o siga con su placeholder.
 */
export function evaluateEnv(source: Record<string, string | undefined>): EnvEvaluation {
  const parsed = safeParseEnv(source);
  const issues = new Map<string, ZodIssue>();
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !issues.has(key)) issues.set(key, issue);
    }
  }

  const results: CheckResult[] = [];
  const seen = new Set<string>();
  for (const key of requiredEnvKeys()) {
    seen.add(key);
    results.push(checkVar(key, source[key], issues.get(key), true));
  }
  for (const [key, issue] of issues) {
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(checkVar(key, source[key], issue, false));
  }
  for (const [key, value] of Object.entries(source)) {
    if (seen.has(key) || !hasPlaceholder(value)) continue;
    if ((COMPOSE_ONLY_KEYS as readonly string[]).includes(key)) continue; // las lista evaluateComposeEnv
    seen.add(key);
    results.push(checkVar(key, value, undefined, false));
  }
  return { results, env: parsed.success ? parsed.data : null };
}

/** Variables que no lee la app pero sí docker-compose.yml (Ruta B). */
export const COMPOSE_ONLY_KEYS = ["DOMAIN", "POSTGRES_PASSWORD"] as const;

export function evaluateComposeEnv(source: Record<string, string | undefined>): CheckResult[] {
  const results: CheckResult[] = [];
  for (const key of COMPOSE_ONLY_KEYS) {
    const value = source[key];
    if (hasPlaceholder(value)) {
      results.push(checkVar(key, value, undefined, true));
    } else if (typeof value === "string" && value !== "") {
      results.push({ status: "ok", label: key, detail: describeValue(key, value) });
    } else {
      results.push({
        status: "skip",
        label: key,
        detail: "não definida: só é usada pelo docker compose (Rota B)",
        fix: fixFor(key),
      });
    }
  }

  // docker compose arma la DATABASE_URL de la app con POSTGRES_PASSWORD; la
  // de .env solo la leen pnpm dev y este doctor. Si no coinciden, lo que se
  // prueba aquí no es lo que correrá en el contenedor.
  const password = source.POSTGRES_PASSWORD;
  const url = source.DATABASE_URL;
  if (password && url && !hasPlaceholder(password) && !hasPlaceholder(url)) {
    try {
      const u = new URL(url);
      if (u.hostname === "postgres" && decodeURIComponent(u.password) !== password) {
        results.push({
          status: "warn",
          label: "POSTGRES_PASSWORD",
          detail: "não corresponde à palavra-passe definida em DATABASE_URL",
          fix: "mantenha-a igual nas duas: o docker compose usa POSTGRES_PASSWORD para a base e a aplicação; DATABASE_URL de .env só é lida por pnpm dev e pnpm doctor",
        });
      }
    } catch {
      // la URL inválida ya salió como ✗ en evaluateEnv
    }
  }
  return results;
}

/* ---------- Base de datos ---------- */

export type DbProbe = (url: string) => Promise<void>;

/** Un `select 1` con las mismas opciones de conexión que la app. */
export const probeDatabase: DbProbe = async (url) => {
  const sql = postgres(url, { max: 1, connect_timeout: 5, ...PG_CONNECTION_OPTIONS });
  try {
    await sql`select 1`;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
};

export async function checkDatabase(
  url: string,
  probe: DbProbe = probeDatabase
): Promise<CheckResult> {
  const started = Date.now();
  try {
    await probe(url);
    return {
      status: "ok",
      label: "DATABASE_URL",
      detail: `select 1 respondeu em ${Date.now() - started} ms (${redactDatabaseUrl(url)})`,
    };
  } catch (err) {
    return describeDbError(err, url);
  }
}

export function describeDbError(err: unknown, url: string): CheckResult {
  const code = String((err as { code?: unknown } | null)?.code ?? "");
  const message = err instanceof Error ? err.message : String(err);
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {}
  const where = redactDatabaseUrl(url);
  const label = "DATABASE_URL";

  if ((code === "ENOTFOUND" || code === "EAI_AGAIN") && hostname === "postgres") {
    return {
      status: "skip",
      label,
      detail: `o host "postgres" só existe dentro da rede do docker compose: não é possível testá-lo daqui (${where})`,
      fix: "inicie com docker compose up -d e confirme com docker compose ps e docker compose logs app: a aplicação valida a ligação ao iniciar e /api/health responde ok quando a base responde",
    };
  }
  switch (code) {
    case "ECONNREFUSED":
      return {
        status: "fail",
        label,
        detail: `não há nada a escutar em ${where}`,
        fix: "inicie o PostgreSQL: docker compose -f docker-compose.dev.yml up -d (desenvolvimento local) ou docker compose up -d postgres (Rota B), ou corrija o anfitrião e a porta em DATABASE_URL",
      };
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return {
        status: "fail",
        label,
        detail: `o host não é resolvido (${where})`,
        fix: "corrija o anfitrião de DATABASE_URL: localhost com docker-compose.dev.yml, postgres dentro do docker compose",
      };
    case "CONNECT_TIMEOUT":
      return {
        status: "fail",
        label,
        detail: `não respondeu em 5 s (${where})`,
        fix: "verifique se o PostgreSQL está em execução e se a porta pode ser alcançada a partir desta máquina",
      };
    case "28P01":
    case "28000":
      return {
        status: "fail",
        label,
        detail: `utilizador ou palavra-passe rejeitados (${where})`,
        fix: "a palavra-passe de DATABASE_URL deve ser a do PostgreSQL (em docker compose, POSTGRES_PASSWORD); se a alterou depois do primeiro arranque, o PostgreSQL mantém a antiga no volume",
      };
    case "3D000":
      return {
        status: "fail",
        label,
        detail: `a base de dados não existe (${where})`,
        fix: "crie-a (CREATE DATABASE vocero) ou deixe que o docker compose a crie com POSTGRES_DB=vocero",
      };
    default:
      return {
        status: "fail",
        label,
        detail: `${message} (${where})`,
        fix: "reveja DATABASE_URL no ficheiro .env e confirme se o PostgreSQL está em execução",
      };
  }
}

/* ---------- Adjuntos ---------- */

/**
 * El mismo sondeo que hacen el arranque y `/api/health` (`mediaWritable`,
 * #82): escribir de verdad y borrar el rastro. Sin caché: aquí se quiere la
 * respuesta de ahora.
 */
export async function checkMediaDir(dir: string): Promise<CheckResult> {
  const media = await probeMediaDir(path.resolve(dir));
  if (media.writable) {
    return { status: "ok", label: "MEDIA_DIR", detail: `${media.dir} permite escrita` };
  }
  return {
    status: "fail",
    label: "MEDIA_DIR",
    detail: `${media.dir} não permite escrita (${media.code}): não seria possível guardar anexos, logótipo e ícone`,
    fix: "fora do Docker: indique em MEDIA_DIR uma pasta com permissão de escrita (ou remova-a: o valor predefinido é ./.dev-media). No Docker, não a defina: a imagem usa /data/media e o docker compose monta o volume em /data",
  };
}

/* ---------- WhatsApp (Meta) ---------- */

export type StoredWhatsApp = {
  organization: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  /** null = la fila existe pero no se pudo descifrar con la ENCRYPTION_KEY actual. */
  credentials: Credentials | null;
};

/**
 * Las conexiones guardadas, organización por organización y por la misma
 * puerta que usa la app (getCredentialsByOrg: query acotada + descifrado).
 * Vocero raíz no tiene credenciales de WhatsApp en el entorno: viven cifradas
 * en la base.
 */
export async function loadWhatsAppCredentials(): Promise<StoredWhatsApp[]> {
  const db = getDb();
  const orgs = await db
    .select({ id: schema.organization.id, name: schema.organization.name })
    .from(schema.organization);
  const out: StoredWhatsApp[] = [];
  for (const org of orgs) {
    try {
      const credentials = await getCredentialsByOrg(org.id);
      if (!credentials) continue;
      out.push({
        organization: org.name,
        phoneNumberId: credentials.phoneNumberId,
        displayPhoneNumber: credentials.displayPhoneNumber,
        credentials,
      });
    } catch (err) {
      // La fila está, pero el token no descifra: ENCRYPTION_KEY distinta.
      // Cualquier otro error (tabla ausente, BD caída) sí sube.
      if (!isDecryptError(err)) throw err;
      const rows = await db
        .select({
          phoneNumberId: schema.metaCredentials.phoneNumberId,
          displayPhoneNumber: schema.metaCredentials.displayPhoneNumber,
        })
        .from(schema.metaCredentials)
        .where(scoped(schema.metaCredentials.organizationId, org.id))
        .limit(1);
      const row = rows[0];
      if (row) {
        out.push({ organization: org.name, ...row, credentials: null });
      }
    }
  }
  return out;
}

function isDecryptError(err: unknown): boolean {
  // GCM con otra clave: "Unsupported state or unable to authenticate data".
  const message = err instanceof Error ? err.message : "";
  return /unable to authenticate|unsupported state|ENCRYPTION_KEY/i.test(message);
}

export type WhatsAppDeps = {
  load?: () => Promise<StoredWhatsApp[]>;
  test?: (phoneNumberId: string, token: string) => Promise<ConnectionCheck>;
};

/**
 * Una llamada de prueba a Meta por conexión guardada, con el mismo
 * testConnection del wizard (GET del número con el token). Sin conexión
 * guardada no es un fallo: WhatsApp se conecta desde la app.
 */
export async function checkWhatsApp(deps: WhatsAppDeps = {}): Promise<CheckResult[]> {
  const load = deps.load ?? loadWhatsAppCredentials;
  const test = deps.test ?? testConnection;

  let stored: StoredWhatsApp[];
  try {
    stored = await load();
  } catch (err) {
    const code = String((err as { code?: unknown } | null)?.code ?? "");
    if (code === "42P01") {
      return [
        {
          status: "skip",
          label: "WhatsApp",
          detail: "as tabelas ainda não existem: as migrações são executadas ao iniciar a aplicação",
          fix: "docker compose up -d (ou pnpm db:migrate em desenvolvimento) e execute novamente pnpm doctor",
        },
      ];
    }
    return [
      {
        status: "warn",
        label: "WhatsApp",
        detail: `não foi possível ler as ligações guardadas: ${err instanceof Error ? err.message : String(err)}`,
        fix: "reveja a ligação à base de dados",
      },
    ];
  }

  if (stored.length === 0) {
    return [
      {
        status: "skip",
        label: "WhatsApp",
        detail: "sem ligação guardada: ligue-se a partir da aplicação (Definições → WhatsApp); não faz parte da instalação",
      },
    ];
  }

  const results: CheckResult[] = [];
  for (const item of stored) {
    const label = `WhatsApp ${item.displayPhoneNumber ?? item.phoneNumberId} (${item.organization})`;
    if (!item.credentials) {
      results.push({
        status: "fail",
        label,
        detail: "não foi possível desencriptar o token guardado: a ENCRYPTION_KEY não é a mesma com que foi guardado",
        fix: "restaure a ENCRYPTION_KEY original ou cole novamente o token em Definições → WhatsApp",
      });
      continue;
    }
    const { token, phoneNumberId } = item.credentials;
    let check: ConnectionCheck;
    try {
      check = await test(phoneNumberId, token);
    } catch (err) {
      results.push({
        status: "warn",
        label,
        detail: `o teste contra a Meta falhou: ${err instanceof Error ? err.message : String(err)}`,
        fix: "tente novamente dentro de alguns minutos",
      });
      continue;
    }
    if (check.ok) {
      const name = check.verifiedName ? ` (${check.verifiedName})` : "";
      results.push({
        status: "ok",
        label,
        detail: `A Meta respondeu ${check.displayPhoneNumber}${name} · token …${tokenLast4(token)}`,
      });
    } else if (check.code === "invalid_token") {
      results.push({
        status: "fail",
        label,
        detail: `${check.message} (token …${tokenLast4(token)})`,
        fix: "Definições → WhatsApp: cole um token válido (modo directo: token de utilizador do sistema, que não expira)",
      });
    } else if (check.code === "meta_unavailable") {
      results.push({ status: "warn", label, detail: check.message, fix: "tente novamente dentro de alguns minutos" });
    } else {
      results.push({
        status: "fail",
        label,
        detail: check.message,
        fix: "reveja o Phone Number ID e o token em Definições → WhatsApp",
      });
    }
  }
  return results;
}

/* ---------- IA (opcional) ---------- */

export function checkAi(env: Env): CheckResult {
  if (!env.OPENROUTER_API_TOKEN) {
    return {
      status: "skip",
      label: "OPENROUTER_API_TOKEN",
      detail: "não definida: o CRM funciona por completo, excepto o agente e o Laboratório",
      fix: "para os activar, defina OPENROUTER_API_TOKEN e OPENROUTER_MODEL no .env (consulte .env.example)",
    };
  }
  if (!env.OPENROUTER_MODEL) {
    return {
      status: "warn",
      label: "OPENROUTER_API_TOKEN",
      detail: "definida, mas sem OPENROUTER_MODEL o agente não sabe que modelo solicitar",
      fix: "no .env: OPENROUTER_MODEL=anthropic/claude-sonnet-4.5 (ou outro disponível em openrouter.ai/models)",
    };
  }
  const judge = env.OPENROUTER_JUDGE_MODEL ? ` · avaliador ${env.OPENROUTER_JUDGE_MODEL}` : "";
  return {
    status: "ok",
    label: "OPENROUTER_API_TOKEN",
    detail: `definida · modelo ${env.OPENROUTER_MODEL}${judge}`,
  };
}

/* ---------- Despacho al cerebro (opcional) ---------- */

/**
 * 021 — `BRAIN_DISPATCH_URL` mal puesta no tumba nada: el despacho queda
 * inactivo y contesta el agente incluido, como en 1.5. Por eso es un aviso y
 * no una ✗: es justo el caso que alguien busca cuando «el cerebro no recibe
 * nada». Nunca se imprime la URL entera (puede llevar ruta con secreto).
 */
export function checkDispatch(
  source: Record<string, string | undefined>
): CheckResult {
  const config = leerConfigDespacho(source);
  const label = "BRAIN_DISPATCH_URL";
  if (config.active) {
    return {
      status: "ok",
      label,
      detail: `o CRM encaminha cada turno para ${config.host}, assinado com BOT_API_KEY; o agente incluído fica em silêncio`,
    };
  }
  if (config.problem === "url") {
    return {
      status: "warn",
      label,
      detail: "não é uma URL http:// ou https:// válida (ou contém utilizador:palavra-passe): o despacho fica INACTIVO",
      fix: "no .env: BRAIN_DISPATCH_URL=http://nea:8000/vocero/dispatch (o endereço interno do seu serviço de IA)",
    };
  }
  if (config.problem === "sin_llave") {
    return {
      status: "warn",
      label,
      detail: `aponta para ${config.host}, mas falta BOT_API_KEY (mínimo 16 caracteres): o envio fica INACTIVO`,
      fix: "no .env: BOT_API_KEY=$(openssl rand -base64 32) e a mesma chave no seu serviço de IA",
    };
  }
  return {
    status: "skip",
    label,
    detail: "não definida: responde o agente incluído ou um cérebro que receba o webhook por sua conta",
  };
}

/* ---------- Salida ---------- */

const MARK: Record<CheckStatus, string> = { ok: "✓", fail: "✗", warn: "!", skip: "-" };

export function formatResult(r: CheckResult): string {
  const head = `${MARK[r.status]} ${r.label}${r.detail ? ` — ${r.detail}` : ""}`;
  return r.fix && r.status !== "ok" ? `${head}\n    → ${r.fix}` : head;
}

export function summarize(results: CheckResult[]) {
  const count = (status: CheckStatus) => results.filter((r) => r.status === status).length;
  const fail = count("fail");
  return { ok: count("ok"), fail, warn: count("warn"), skip: count("skip"), exitCode: fail > 0 ? 1 : 0 };
}

/**
 * 037 — Con `MEDIA_STORE=bucket`, el mismo sondeo que el arranque: escribir y
 * borrar un objeto en el bucket. Sin la bandera no se menciona (constitución
 * II.3.1: apagado, el conector no existe). Solo enseña el host, nunca llaves.
 */
export async function checkMediaBucket(env: Record<string, string | undefined>): Promise<CheckResult | null> {
  if ((env.MEDIA_STORE ?? "").trim().toLowerCase() !== "bucket") return null;
  const label = "Bucket de adjuntos";
  const { MEDIA_BUCKET_ENDPOINT: endpoint, MEDIA_BUCKET_NAME: bucket, MEDIA_BUCKET_KEY_ID: keyId, MEDIA_BUCKET_SECRET: secret } = env;
  if (!endpoint || !bucket || !keyId || !secret) {
    return {
      status: "fail",
      label,
      detail: "MEDIA_STORE=bucket, mas faltam variáveis do bucket: os anexos são guardados no disco",
      fix: "defina MEDIA_BUCKET_ENDPOINT, MEDIA_BUCKET_NAME, MEDIA_BUCKET_KEY_ID e MEDIA_BUCKET_SECRET (e MEDIA_BUCKET_REGION se não for `auto`), ou remova MEDIA_STORE",
    };
  }
  let host: string;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocolo");
    host = url.host;
  } catch {
    return { status: "fail", label, detail: "MEDIA_BUCKET_ENDPOINT não é um URL http(s) válido", fix: "por exemplo: http://minio:9000 ou https://<conta>.r2.cloudflarestorage.com" };
  }
  const r = await probeBucket({
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    accessKeyId: keyId,
    secretAccessKey: secret,
    region: env.MEDIA_BUCKET_REGION || "auto",
  });
  if (r.writable) return { status: "ok", label, detail: `${host}/${bucket} aceita escrita` };
  return {
    status: "fail",
    label,
    detail: `${host}/${bucket} não aceita escrita (${r.code}): os anexos são guardados no disco enquanto isso`,
    fix: "confirme que o bucket existe, que a chave tem permissão de escrita e que a região está correcta (MinIO e R2: `auto` ou `us-east-1`)",
  };
}
