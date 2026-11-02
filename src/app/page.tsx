import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";
import { guideFirst } from "@/server/onboarding/guide";

export const dynamic = "force-dynamic";

/**
 * A raiz decide para onde entrar (issue #86): enquanto faltar um passo do
 * guia de início ou o agente continuar desligado, vai para `/onboarding`;
 * quando tudo estiver pronto, vai para a Caixa de entrada como habitualmente.
 * Sem sessão, `/inbox` encaminha para o início de sessão.
 */
export default async function Home() {
  const session = await getSessionOrNull();
  if (session && (await guideFirst(session))) redirect("/onboarding");
  redirect("/inbox");
}
