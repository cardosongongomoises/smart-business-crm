"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmbeddedSignup } from "./embedded-signup";
import { EntregasCard } from "./entregas-card";

type Connection = {
  wabaId: string;
  messagingAccountId: string | null;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  status: "connected" | "reconnect_required";
  tokenLast4: string;
};

type WebhookInfo = {
  url: string;
  verifyToken: string;
  isHttps: boolean;
  signatureLayer: boolean;
};

/** Lo que devuelve el registro del webhook en Meta (al guardar o a demanda). */
type WebhookRegistration =
  | { ok: true; appWithoutWebhook: boolean; messagingAccount?: MessagingAccountRegistration }
  | { ok: true; skipped: "waba_override"; host: string }
  | { ok: false; message: string };

/** 065 — El registro en la Cuenta de mensajes, aparte del del número. */
type MessagingAccountRegistration =
  | { ok: true; skipped?: "override_ajeno"; host?: string }
  | { ok: false; message: string };

/**
 * El último registro, y desde dónde se pidió. Uno solo para las dos tarjetas:
 * con uno por tarjeta, guardar con un token sin permiso dejaba el «registrado»
 * de un clic anterior al lado del aviso nuevo.
 */
type LastRegistration = {
  result: WebhookRegistration;
  from: "save" | "button" | "embedded";
};

export function WhatsappWizard() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [registration, setRegistration] = useState<LastRegistration | null>(
    null
  );

  const refetch = useCallback(async () => {
    const [c, w] = await Promise.all([
      fetch("/api/settings/whatsapp").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/webhook").then((r) => (r.ok ? r.json() : null)),
    ]).catch(() => [null, null]);
    if (c) setConnection(c.connection);
    if (w) setWebhook(w);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">A carregar…</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {connection?.status === "reconnect_required" && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-danger-soft bg-danger-tint p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-[12rem] flex-1">
            <p className="font-medium text-danger-text">
              O token do WhatsApp expirou ou foi revogado.
            </p>
            <p className="text-danger-text opacity-80">
              Os envios estão em pausa. Cole um token novo abaixo e teste a ligação para ligar novamente.
            </p>
          </div>
          <Desligar
            onHecho={() => {
              setRegistration(null);
              void refetch();
            }}
          />
        </div>
      )}

      {connection && connection.status === "connected" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success-soft bg-success-tint p-4">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div className="min-w-[12rem] flex-1 text-sm">
            <p className="font-medium text-success-text">
              Número ligado: {connection.displayPhoneNumber ?? connection.phoneNumberId}
            </p>
            <p className="text-success-text opacity-80">
              {connection.verifiedName ? `${connection.verifiedName} · ` : ""}
              token …{connection.tokenLast4}
            </p>
          </div>
          <Badge variant="success">Ligado</Badge>
          <Desligar
            onHecho={() => {
              setRegistration(null);
              void refetch();
            }}
          />
        </div>
      )}

      {/* 066 — La conexión oficial con Meta. Sin la app configurada en la
          instancia no se dibuja y queda solo el alta manual de abajo. */}
      <EmbeddedSignup
        onConnected={(r) => {
          setRegistration({ result: r.webhook as WebhookRegistration, from: "embedded" });
          void refetch();
        }}
      />
      {registration?.from === "embedded" && (
        <RegistrationNotice registration={registration.result} afterSave />
      )}

      <ConnectForm
        // 066 — Se rehace si la conexión cambia por «Ligar con Meta»:
        // los campos toman los IDs nuevos.
        key={connection?.phoneNumberId ?? "sin-conexion"}
        existing={connection}
        registration={registration?.from === "save" ? registration.result : null}
        onRegistration={(result) =>
          setRegistration(result ? { result, from: "save" } : null)
        }
        onSaved={() => void refetch()}
      />

      {webhook && (
        <WebhookCard
          webhook={webhook}
          connection={connection}
          registration={registration?.from === "button" ? registration.result : null}
          onRegistration={(result) =>
            setRegistration(result ? { result, from: "button" } : null)
          }
        />
      )}

      {/* 047 — Lo que llegó y no pudo entrar a la bandeja. */}
      {connection && <EntregasCard />}
    </div>
  );
}

/**
 * Soltar el número.
 *
 * Pide confirmación porque corta la entrada y la salida de mensajes al
 * instante — no es un ajuste, es apagar el canal. Lo que NO hace es borrar la
 * bandeja, y el aviso lo dice: sin eso, nadie se atreve a tocarlo.
 */
function Desligar({ onHecho }: { onHecho: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function desconectar() {
    setYendo(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/whatsapp", { method: "DELETE" });
      if (res.ok) {
        setConfirmando(false);
        onHecho();
      } else {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(data?.error?.message ?? "Não foi possível desligar o número.");
      }
    } catch {
      setError("Sem ligação ao servidor.");
    } finally {
      setYendo(false);
    }
  }

  if (!confirmando) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>
        Desligar
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        Deixará de receber e enviar. As suas conversas são mantidas.
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={yendo}
        onClick={() => setConfirmando(false)}
      >
        Cancelar
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={yendo}
        onClick={() => void desconectar()}
      >
        {yendo ? "A desligar…" : "Sim, desligar"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

function ConnectForm({
  existing,
  registration,
  onRegistration,
  onSaved,
}: {
  existing: Connection | null;
  registration: WebhookRegistration | null;
  onRegistration: (result: WebhookRegistration | null) => void;
  onSaved: () => void;
}) {
  const [wabaId, setWabaId] = useState(existing?.wabaId ?? "");
  const [messagingAccountId, setMessagingAccountId] = useState(
    existing?.messagingAccountId ?? ""
  );
  const [phoneNumberId, setPhoneNumberId] = useState(
    existing?.phoneNumberId ?? ""
  );
  const [token, setToken] = useState("");
  const [testResult, setTestResult] = useState<
    | { ok: true; display: string }
    | { ok: false; message: string }
    | null
  >(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canTest = wabaId.trim() && phoneNumberId.trim() && token.trim();

  async function test() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/settings/whatsapp/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phoneNumberId, token }),
    }).catch(() => null);
    setTesting(false);
    if (!res) {
      setTestResult({ ok: false, message: "Sem ligação ao servidor" });
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      displayPhoneNumber?: string;
      error?: { message?: string };
    } | null;
    if (res.ok && data?.displayPhoneNumber) {
      setTestResult({ ok: true, display: data.displayPhoneNumber });
    } else {
      setTestResult({
        ok: false,
        message: data?.error?.message ?? "A validação falhou",
      });
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    onRegistration(null);
    const res = await fetch("/api/settings/whatsapp", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wabaId,
        phoneNumberId,
        token,
        // 065 — Vacía con una guardada = quitarla; vacía sin guardada = que
        // el servidor intente descubrirla.
        ...(messagingAccountId.trim() || existing?.messagingAccountId
          ? { messagingAccountId: messagingAccountId.trim() }
          : {}),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setSaveError(data?.error?.message ?? "Não foi possível guardar a ligação");
      return;
    }
    const saved = (await res.json().catch(() => null)) as {
      webhook?: WebhookRegistration;
    } | null;
    onRegistration(saved?.webhook ?? null);
    setToken("");
    setTestResult(null);
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {existing ? "Ligar novamente / actualizar o número" : "Ligar o seu número do WhatsApp"}
        </CardTitle>
        <CardDescription>
          Cole as credenciais da WhatsApp Cloud API. O token é validado
          na Meta ANTES de ser guardado e fica armazenado de forma encriptada. Ao guardar, o
          webhook é registado na Meta automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-md border bg-background p-4 text-sm">
          <p className="font-medium">De onde vem o token?</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="mb-1 font-medium text-primary">Modo directo</p>
              <p className="text-muted-foreground">
                A empresa tem a sua própria aplicação em{" "}
                <span className="text-foreground">developers.facebook.com</span>:
                use um token de <span className="text-foreground">utilizador do sistema</span>{" "}
                (não expira) com permissões do WhatsApp. Neste modo, é recomendável
                configurar também o App Secret para a assinatura do webhook.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="mb-1 font-medium text-primary">Modo agência (Tech Provider)</p>
              <p className="text-muted-foreground">
                A sua agência faz o Embedded Signup na SUA plataforma e o seu
                backend obtém o token do cliente; entrega-lho para
                colar aqui. Ao guardar, o webhook é registado no número
                (<span className="text-foreground">override del número</span>),
                tal como no modo directo; se a sua agência já encaminha a conta para o
                seu próprio backend, isso é respeitado.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="waba-id">WABA ID</Label>
            <Input
              id="waba-id"
              placeholder="ID da conta do WhatsApp Business"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone-number-id">Phone Number ID</Label>
            <Input
              id="phone-number-id"
              placeholder="ID do número de telefone"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="messaging-account-id">
            ID da Conta de mensagens{" "}
            <span className="font-normal text-muted-foreground">(recomendado)</span>
          </Label>
          <Input
            id="messaging-account-id"
            inputMode="numeric"
            placeholder="Definições da empresa › Contas › Contas de mensagens"
            value={messagingAccountId}
            onChange={(e) => setMessagingAccountId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Desde 2026, a Meta separa a conta do WhatsApp (o número) da Conta de
            mensagens (modelos e pagamentos). Com esta conta, os modelos são
            criados onde a Meta os aceita e o webhook é registado em ambas. Se
            deixar este campo vazio, tentaremos encontrá-la.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="token">Token de acesso</Label>
          <Input
            id="token"
            type="password"
            placeholder={existing ? `Guardado (…${existing.tokenLast4}) — introduza um novo para o alterar` : "EAAG…"}
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setTestResult(null);
            }}
          />
        </div>

        {testResult && (
          <p
            className={`text-sm ${testResult.ok ? "text-success" : "text-destructive"}`}
          >
            {testResult.ok
              ? `✓ Token válido para ${testResult.display}. Já pode guardar.`
              : testResult.message}
          </p>
        )}
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        {registration && (
          <RegistrationNotice registration={registration} afterSave />
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!canTest || testing}
            onClick={() => void test()}
          >
            {testing ? "A testar…" : "Testar ligação"}
          </Button>
          <Button
            disabled={!testResult?.ok || saving}
            onClick={() => void save()}
          >
            {saving ? "A guardar…" : "Guardar ligação"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * El resultado de registrar el webhook en Meta, en palabras de quien lo lee.
 *
 * Un fallo aquí NO deshace el guardado: el token es válido y la conexión
 * envía. Por eso el aviso es de advertencia, no de error, y dice qué hacer.
 */
function RegistrationNotice({
  registration,
  afterSave = false,
}: {
  registration: WebhookRegistration;
  afterSave?: boolean;
}) {
  if (registration.ok && "messagingAccount" in registration && registration.messagingAccount) {
    const { messagingAccount, ...delNumero } = registration;
    return (
      <div className="space-y-2">
        <RegistrationNotice registration={delNumero} afterSave={afterSave} />
        <MessagingAccountNotice result={messagingAccount} />
      </div>
    );
  }
  if (registration.ok && "skipped" in registration) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          A sua conta do WhatsApp já encaminha os webhooks para{" "}
          <span className="text-foreground">{registration.host}</span> (um
          agente externo ou o backend da sua agência). Mantemos esta
          configuração: o número fica sem webhook próprio e as mensagens
          continuam a chegar a esse serviço.
        </span>
      </p>
    );
  }
  if (registration.ok && !registration.appWithoutWebhook) {
    return (
      <p className="flex items-start gap-2 text-sm text-success">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        Webhook registado na Meta: as mensagens deste número chegam aqui.
        Não é necessário colar nada no painel da sua aplicação.
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning-soft bg-warning-tint p-3 text-xs text-warning-text">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {registration.ok ? (
          <>
            O webhook foi registado no número, mas a Meta não indica nenhum
            webhook na sua aplicação. Se não receber mensagens, aceda a
            developers.facebook.com → a sua aplicação → WhatsApp → Definições,
            confirme o URL de callback (pode usar o apresentado abaixo) e
            subscreva o campo <code>messages</code>. Basta fazer isto uma vez
            por aplicação.
          </>
        ) : (
          <>
            {afterSave ? "A ligação foi guardada, mas não" : "Não"} foi possível
            registar o webhook na Meta. {registration.message} Tente novamente
            com «Registar na Meta» ou introduza manualmente o URL e o token de
            verificação.
          </>
        )}
      </span>
    </p>
  );
}

/** 065 — Cómo quedó el webhook en la Cuenta de mensajes del split de 2026. */
function MessagingAccountNotice({ result }: { result: MessagingAccountRegistration }) {
  if (result.ok && result.skipped) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          A sua Conta de mensagens já encaminha os webhooks para{" "}
          <span className="text-foreground">{result.host}</span>. Se respeta.
        </span>
      </p>
    );
  }
  if (result.ok) {
    return (
      <p className="flex items-start gap-2 text-sm text-success">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        Webhook também registado na Conta de mensagens.
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning-soft bg-warning-tint p-3 text-xs text-warning-text">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {result.message} Sin esto, en las cuentas de Meta ya separadas los
        mensajes entrantes pueden no llegar.
      </span>
    </p>
  );
}

function WebhookCard({
  webhook,
  connection,
  registration,
  onRegistration,
}: {
  webhook: WebhookInfo;
  connection: Connection | null;
  registration: WebhookRegistration | null;
  onRegistration: (result: WebhookRegistration | null) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const canRegister = connection?.status === "connected";

  async function register(recuperar = false) {
    if (recuperar) {
      const host = registration?.ok && "skipped" in registration ? registration.host : "otro servicio";
      const ok = window.confirm(
        `Recuperar o webhook: as mensagens do seu número deixarão de chegar a ${host} e passarão a chegar a este CRM, que as encaminhará ao seu agente. Deseja continuar?`
      );
      if (!ok) return;
    }
    setRegistering(true);
    onRegistration(null);
    const res = await fetch("/api/settings/webhook", {
      method: "POST",
      ...(recuperar
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ recuperar: true }) }
        : {}),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | (WebhookRegistration & { error?: { message?: string } })
      | null;
    setRegistering(false);
    if (res?.ok && data?.ok) {
      onRegistration(data);
    } else {
      onRegistration({
        ok: false,
        message: data?.error?.message ?? "Sem ligação ao servidor.",
      });
    }
  }

  function copy(text: string, which: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook do WhatsApp</CardTitle>
        <CardDescription>
          Ao guardar a ligação, este endereço é registado na Meta automaticamente, no
          número (override). Estes valores são para o backend ou para configurar
          manualmente no painel da Meta apenas se o registo automático falhar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canRegister && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              disabled={registering}
              onClick={() => void register(false)}
            >
              {registering ? "A registar…" : "Registar na Meta"}
            </Button>
            {registration && <RegistrationNotice registration={registration} />}
            {/* 035 — Quien venía con Nea 1.x delante del CRM: el webhook vive en
                un override ajeno de la WABA y el registro normal lo respeta. */}
            {registration?.ok && "skipped" in registration && (
              <Button
                variant="outline"
                size="sm"
                disabled={registering}
                onClick={() => void register(true)}
              >
                Recuperar o webhook
              </Button>
            )}
          </div>
        )}
        {!webhook.isHttps && (
          <p className="flex items-start gap-2 rounded-md border border-warning-soft bg-warning-tint p-3 text-xs text-warning-text">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            O URL configurado não usa HTTPS; a Meta exige HTTPS para webhooks.
            Ajuste APP_BASE_URL para o seu domínio público.
          </p>
        )}
        <div className="space-y-1.5">
          <Label>URL do webhook (URL de callback)</Label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 text-xs">
              {webhook.url}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copiar o URL"
              onClick={() => copy(webhook.url, "url")}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {copied === "url" && (
              <span className="text-xs text-primary">Copiado ✓</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            O URL contém o token secreto no caminho: trate-o como uma palavra-passe.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Token de verificação</Label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 text-xs">
              {webhook.verifyToken}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copiar o token de verificação"
              onClick={() => copy(webhook.verifyToken, "vt")}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {copied === "vt" && (
              <span className="text-xs text-primary">Copiado ✓</span>
            )}
          </div>
        </div>
        {webhook.signatureLayer ? (
          <p className="flex items-center gap-2 text-xs text-success">
            <ShieldCheck className="h-4 w-4" /> Verificação de assinatura ativa
            (META_APP_SECRET configurado): cada evento é validado com
            x-hub-signature-256.
          </p>
        ) : (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> Sem App Secret
            configurado: o webhook fica protegido pelo URL secreto (normal no
            modo de agência). Para acrescentar a assinatura, configure
            META_APP_SECRET na instância.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
