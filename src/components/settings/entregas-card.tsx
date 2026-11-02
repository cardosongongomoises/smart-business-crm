"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Entregas = {
  pendientes: number;
  agotados: number;
  ultimoError: string | null;
  ultimoFalloEn: string | null;
};

/** Cada cuánto se refresca mientras hay algo en reintento. */
const REFRESCO_MS = 15_000;

function hora(iso: string): string {
  return new Date(iso).toLocaleString("pt-AO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 047 — Las entregas del webhook que no han entrado a la bandeja.
 *
 * Cada evento se guarda antes de procesarse; si falla, se reintenta solo
 * (30 s, 2 min, 10 min, 1 h y 6 h). Lo que se agota se enseña aquí con su
 * error y un botón para volver a intentarlo. Sin permiso de configurar, la
 * API responde 403 y la tarjeta no aparece.
 */
export function EntregasCard() {
  const [estado, setEstado] = useState<Entregas | null>(null);
  const [reintentando, setReintentando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/settings/webhook/eventos").catch(() => null);
    if (res?.ok) setEstado((await res.json()) as Entregas);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const enReintento = (estado?.pendientes ?? 0) > 0;
  useEffect(() => {
    if (!enReintento) return;
    const t = setInterval(() => void cargar(), REFRESCO_MS);
    return () => clearInterval(t);
  }, [enReintento, cargar]);

  async function reintentar() {
    setReintentando(true);
    setAviso(null);
    const res = await fetch("/api/settings/webhook/eventos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accion: "reintentar" }),
    }).catch(() => null);
    setReintentando(false);
    if (!res?.ok) {
      setAviso("Não foi possível tentar novamente. Verifique a ligação ao servidor.");
      return;
    }
    const data = (await res.json()) as Entregas & { reintentados: number };
    setEstado(data);
    setAviso(
      data.agotados === 0 && data.pendientes === 0
        ? `Concluído: ${data.reintentados === 1 ? "o evento chegou à caixa de entrada" : `os ${data.reintentados} eventos chegaram à caixa de entrada`}.`
        : "Nova tentativa concluída. O que falhar novamente continuará aqui."
    );
  }

  if (!estado) return null;

  return (
    <Card data-testid="entregas-webhook">
      <CardHeader>
        <CardTitle>Entregas</CardTitle>
        <CardDescription>
          Cada mensagem recebida é guardada antes de ser processada. Se algo
          falhar, haverá novas tentativas automáticas; após seis tentativas, o
          que não for processado ficará aqui para tentar novamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {estado.agotados > 0 ? (
          <div
            role="alert"
            className="flex flex-wrap items-start gap-3 rounded-lg border border-danger-soft bg-danger-tint p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-[12rem] flex-1 space-y-1">
              <p className="font-medium text-danger-text">
                {estado.agotados === 1
                  ? "1 entrega não chegou à caixa de entrada."
                  : `${estado.agotados} entregas não chegaram à caixa de entrada.`}
              </p>
              {estado.ultimoError && (
                <p className="break-words text-danger-text opacity-80">
                  {estado.ultimoFalloEn ? `${hora(estado.ultimoFalloEn)} · ` : ""}
                  {estado.ultimoError}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={reintentando}
              onClick={() => void reintentar()}
            >
              <RotateCw className="h-4 w-4" />
              {reintentando ? "A tentar novamente…" : "Tentar novamente"}
            </Button>
          </div>
        ) : (
          !enReintento && (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Entregas em dia: tudo o que
              chegou entrou na caixa de entrada.
            </p>
          )
        )}
        {enReintento && (
          <p className="flex items-start gap-2 rounded-md border border-warning-soft bg-warning-tint p-3 text-xs text-warning-text">
            <RotateCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {estado.pendientes === 1
              ? "1 entrega em nova tentativa: será processada automaticamente assim que possível."
              : `${estado.pendientes} entregas em nova tentativa: serão processadas automaticamente assim que possível.`}
          </p>
        )}
        {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
      </CardContent>
    </Card>
  );
}
