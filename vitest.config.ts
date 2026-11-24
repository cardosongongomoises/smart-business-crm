import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // El tsconfig dice `jsx: "preserve"` porque de JSX se encarga Next. Vitest
  // no es Next: sin esto compila el JSX al runtime clásico (`React.
  // createElement` sin importar React) y un componente no se puede dibujar
  // en una prueba (ver tests/unit/switch.test.ts).
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Unit tests stub all outbound transports; this is isolated to Vitest and
    // does not change the application default (TESTE).
    env: { AGENTES_DIGITAL_MODE: "producao" },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
