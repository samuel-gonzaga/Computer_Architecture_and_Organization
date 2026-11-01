import type { Metadata } from "next";
import { IBM_Plex_Sans_Condensed, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeoCore Computer Lab",
  description:
    "Simulador didático do ciclo de busca, decodificação e execução de uma CPU.",
};

// Aplica o tema escolhido antes da primeira pintura (evita piscar o tema errado).
const THEME_SCRIPT = `try{var t=localStorage.getItem("neocore-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${plexCondensed.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
