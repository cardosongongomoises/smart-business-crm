import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { accentCssVariables, DEFAULT_BRANDING } from "@/lib/branding";
import { faviconHref } from "@/lib/favicon";
import { appIconHref, NAV_INK, shortAppName } from "@/lib/pwa";
import { RegistrarServiceWorker } from "@/components/pwa";
import { atributosHtml, cssDePropio, cssDeTemas } from "@/lib/temas";
import { aparienciaActual } from "@/server/apariencia";
import { getBranding } from "@/server/branding";
import { enabledChannels } from "@/server/channels/enabled";
import { productName } from "@/lib/channels";
import "./globals.css";

// Tipos de letra da marca, dentro do repositório (`./fonts`, subconjunto latino
// do Google Fonts, licença OFL em `fonts/licencias/`). Antes, o next/font
// descarregava-os do Google em cada BUILD e uma falha dessa rede interrompia o
// build; assim, nem o build nem o runtime acedem à internet (soberania). 061 —
// A interface usa Urbanist (geométrica e leve, como na referência do design de
// cartões); Archivo, a de vocerocrm.com, fica carregada para ser escolhida
// (062). `--font-sans` é definido no globals.css a partir destas fontes.
const urbanist = localFont({
  src: "./fonts/urbanist-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-urbanist",
  display: "swap",
});
const archivo = localFont({
  src: "./fonts/archivo-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-archivo",
  display: "swap",
});
// 062 — Os outros dois tipos de letra escolhidos em Definições → Aparência.
const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});
const plexSans = localFont({
  src: "./fonts/ibm-plex-sans-latin-variable.woff2",
  weight: "400 700",
  variable: "--font-plex-sans",
  display: "swap",
});
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: false,
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding().catch(() => DEFAULT_BRANDING);
  const producto = productName([...enabledChannels()]);
  return {
    title: `${branding.name} — ${producto}`,
    description: `${producto} com agente de IA e Laboratório de auto-avaliação`,
    // O `?v=` muda com a marca: os navegadores guardam o favicon de forma
    // persistente e, sem isso, o novo logótipo demora dias a aparecer.
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
        { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
        { url: faviconHref(branding) },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        { url: appIconHref(branding, 180), sizes: "180x180" },
      ],
    },
    manifest: "/site.webmanifest",
    // 048 — Quando instalada a partir do Safari, abre sem a barra do navegador.
    // Barra de estado preta e não translúcida: a página não tem margem para o notch.
    appleWebApp: { capable: true, title: shortAppName(branding.name), statusBarStyle: "black" },
  };
}

/** 048 — A barra de estado da aplicação instalada, com a cor da barra lateral. */
export const viewport: Viewport = { themeColor: NAV_INK };

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await getBranding().catch(() => DEFAULT_BRANDING);
  // 062 · D6 — A aparência (tema, tipo de letra, tamanho e densidade) é
  // resolvida no servidor: o primeiro desenho já a inclui, sem cintilação.
  const { apariencia } = await aparienciaActual().catch(() => ({
    apariencia: { tema: "menta", letra: "urbanist", tamano: "normal", densidad: "normal" } as const,
  }));
  return (
    <html
      lang="pt"
      className={`${urbanist.variable} ${archivo.variable} ${inter.variable} ${plexSans.variable} ${instrumentSerif.variable} ${plexMono.variable}`}
      // A preferência é sempre explícita: segue resolvida no HTML do servidor,
      // por isso não há divergência com o cliente nem cintilação.
      {...atributosHtml(apariencia)}
    >
      <head>
        {/* Acento white-label injectado no SSR: sem cintilação do tema */}
        <style
          dangerouslySetInnerHTML={{ __html: accentCssVariables(branding.accent) }}
        />
        {/* 062 — Os temas disponíveis (todos, para mudar em tempo real) e o próprio. */}
        <style
          id="vocero-temas"
          dangerouslySetInnerHTML={{ __html: cssDeTemas() + cssDePropio(apariencia) }}
        />
      </head>
      <body className="font-sans">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
