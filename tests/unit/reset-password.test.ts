import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "better-auth/crypto";

/**
 * `scripts/reset-password.mjs` é a única forma de recuperar o acesso quando alguém
 * perde a palavra-passe: não há recuperação por e-mail e o registo público
 * fecha-se com a primeira organização.
 *
 * Por isso é testado como um subprocesso real, tal como o executaria
 * uma pessoa, em vez de importar as suas peças: `scripts/**` está fuera de
 * eslint e do tsconfig, por isso este ficheiro é a ÚNICA cobertura automática
 * existente. O que se verifica é o que importa — que o hash que imprime
 * realmente deje entrar.
 */

const exec = promisify(execFile);
const SCRIPT = path.resolve(import.meta.dirname, "../../scripts/reset-password.mjs");
const TIMEOUT = 20_000;

/** Extrai o hash `salt:clave` do SQL impresso pelo script. */
function hashDeLaSalida(stdout: string): string | null {
  return stdout.match(/'([0-9a-f]{32}:[0-9a-f]{128})'/)?.[1] ?? null;
}

async function correr(args: string[], password?: string) {
  const env = { ...process.env };
  delete env.NEW_PASSWORD;
  if (password !== undefined) env.NEW_PASSWORD = password;
  try {
    const { stdout, stderr } = await exec(process.execPath, [SCRIPT, ...args], { env });
    return { code: 0, stdout, stderr };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

describe("reset-password", () => {
  it(
    "o hash impresso permite entrar com essa palavra-passe e não com outra",
    async () => {
      const password = "una-contrasena-nueva-123";
      const { code, stdout } = await correr(["duena@ejemplo.com"], password);
      expect(code).toBe(0);

      const hash = hashDeLaSalida(stdout);
      expect(hash).not.toBeNull();

      // O que realmente importa: o better-auth aceita esse hash.
      expect(await verifyPassword({ hash: hash!, password })).toBe(true);
      expect(await verifyPassword({ hash: hash!, password: "otra-cosa-999" })).toBe(false);
    },
    TIMEOUT
  );

  it(
    "acentos e ñ sobrevivem à conversão (normalización NFKC)",
    async () => {
      const password = "contraseña-única-ñandú";
      const { code, stdout } = await correr(["duena@ejemplo.com"], password);
      expect(code).toBe(0);
      expect(await verifyPassword({ hash: hashDeLaSalida(stdout)!, password })).toBe(true);
    },
    TIMEOUT
  );

  it("um hash gerado anteriormente continua a ser verificado (canario de formato)", async () => {
    // Congelado de propósito. Se uma versão futura do better-auth alterar o
    // formato ou os parâmetros do scrypt, isto fica vermelho AQUI — antes de
    // as palavras-passe já guardadas deixarem de funcionar em produção e
    // ninguém conseguir entrar para corrigir o problema.
    const congelado =
      "181acaf1397646b882722b5b5b7f71e7:b8106a42eb4765159f070a73f3bb5cd2f8839753da5b959dc4096a88e6af95a2622146a025f42c10cf6865fbbd065ecdc04766f19c0ba90992fff8080a5c847e";
    expect(
      await verifyPassword({ hash: congelado, password: "canario-de-formato-vocero" })
    ).toBe(true);
  });

  it(
    "o SQL aponta para a credencial do utilizador, não para toda a tabela",
    async () => {
      const { stdout } = await correr(["duena@ejemplo.com"], "una-contrasena-nueva-123");
      // As aspas são escapadas porque o SQL segue dentro de `psql -c "…"`.
      expect(stdout).toContain(`\\"provider_id\\" = 'credential'`);
      expect(stdout).toContain(`lower(\\"email\\") = lower('duena@ejemplo.com')`);
      // Sem um WHERE limitado, uma reposição atribuiria a mesma palavra-passe a toda a
      // equipa — um incidente de segurança disfarçado de recuperação.
      expect(stdout).toContain("WHERE");
      expect(stdout.match(/UPDATE \\"account\\"/g)).toHaveLength(1);
    },
    TIMEOUT
  );

  it(
    "uma aspa no e-mail é escapada em vez de quebrar o SQL",
    async () => {
      const { code, stdout } = await correr(["o'brien@ejemplo.com"], "una-contrasena-nueva-123");
      expect(code).toBe(0);
      expect(stdout).toContain("o''brien@ejemplo.com");
    },
    TIMEOUT
  );

  describe("guardas", () => {
    it("sem argumentos não imprime SQL e termina com erro", async () => {
      const { code, stdout, stderr } = await correr([]);
      expect(code).toBe(1);
      expect(stdout).not.toContain("UPDATE");
      expect(stderr).toContain("NEW_PASSWORD");
    });

    it("sem e-mail também não, mesmo que exista palavra-passe", async () => {
      const { code, stdout } = await correr([], "una-contrasena-nueva-123");
      expect(code).toBe(1);
      expect(stdout).not.toContain("UPDATE");
    });

    it("uma palavra-passe curta é rejeitada antes de gerar qualquer coisa", async () => {
      const { code, stdout, stderr } = await correr(["duena@ejemplo.com"], "corta");
      expect(code).toBe(1);
      expect(stdout).not.toContain("UPDATE");
      expect(stderr).toContain("8 caracteres");
    });
  });
});
