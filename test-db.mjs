import postgres from "postgres";

const connStr = "postgresql://postgres.kwpmcaxxnercxhxlwdbt:AgentesDigital2026!Db@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require";

async function test() {
  console.log("Conectando ao Supabase via Pooler...");
  const sql = postgres(connStr, {
    max: 1,
    connection: { TimeZone: "UTC" }
  });
  try {
    const res = await sql`SELECT 1 as teste, current_database(), current_user`;
    console.log("Conexão com SUCESSO!", res);
  } catch (err) {
    console.error("Erro na conexão:", err);
  } finally {
    await sql.end();
  }
}

test();
