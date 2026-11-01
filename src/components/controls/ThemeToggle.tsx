"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Tema: sistema", light: "Tema: claro", dark: "Tema: escuro" };
const STORAGE_KEY = "neocore-theme";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Alterna o tema entre sistema, claro e escuro (a escolha fica salva neste navegador). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  // O tema salvo só existe no navegador; o HTML estático é gerado com "sistema".
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o localStorage após a hidratação
    setTheme(readTheme());
  }, []);

  const choose = () => {
    const next = NEXT[theme];
    setTheme(next);
    if (next === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = next;
    }
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sem armazenamento (ex.: janela privada): o tema vale só nesta visita.
    }
  };

  return (
    <button
      type="button"
      onClick={choose}
      className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      aria-label={`${LABEL[theme]}. Clique para trocar.`}
    >
      {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"} {LABEL[theme]}
    </button>
  );
}
