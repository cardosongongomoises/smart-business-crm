import { describe, expect, it } from "vitest";
import {
  CLAVES_HERRAMIENTA,
  HERRAMIENTAS,
  ROLES,
  herramientasEfectivas,
  rolDe,
} from "@/lib/agent-roles";
import { PERSONAS } from "@/server/lab/personas";
import { personasDelRol } from "@/server/lab/runner";

/** 034 — Papéis como dados: o catálogo, o Qualificador e as suas pessoas. */
describe("o catálogo de ferramentas", () => {
  it("as chaves são um contrato com o cérebro", () => {
    expect(CLAVES_HERRAMIENTA).toEqual(["ficha", "etapa", "agendar", "reprogramar", "salida", "escalar"]);
  });

  it("escalar é fixa e as de agenda indicam-no", () => {
    expect(HERRAMIENTAS.filter((h) => h.fija).map((h) => h.clave)).toEqual(["escalar"]);
    expect(HERRAMIENTAS.filter((h) => h.agenda).map((h) => h.clave)).toEqual(["agendar", "reprogramar"]);
  });

  it("null = todas; uma lista vazia deixa apenas escalar; a ordem é a do catálogo", () => {
    expect(herramientasEfectivas(null)).toEqual([...CLAVES_HERRAMIENTA]);
    expect(herramientasEfectivas([])).toEqual(["escalar"]);
    expect(herramientasEfectivas(["salida", "ficha"])).toEqual(["ficha", "salida", "escalar"]);
  });
});

describe("o papel Qualificador", () => {
  it("contém instruções, regras de escalamento e todas as ferramentas", () => {
    const r = ROLES.calificador;
    expect(r.instrucciones.length).toBeGreaterThan(50);
    expect(r.reglasDeEscalado.length).toBeGreaterThan(20);
    expect([...r.herramientas]).toEqual([...CLAVES_HERRAMIENTA]);
  });

  it("todas as suas pessoas existem no Laboratório", () => {
    expect(personasDelRol("calificador").map((p) => p.key)).toEqual([...ROLES.calificador.personas]);
    expect(personasDelRol("calificador")).toHaveLength(PERSONAS.length);
  });

  it("um papel desconhecido recorre ao Qualificador", () => {
    expect(rolDe("inventado").clave).toBe("calificador");
    expect(rolDe(null).clave).toBe("calificador");
  });
});
