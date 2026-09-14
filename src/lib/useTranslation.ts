"use client";

import { useEffect, useSyncExternalStore } from "react";
import { t, type Lang } from "@/lib/i18n";
import { getLanguage, setLanguage, subscribe } from "@/lib/language";

function useGlobalLanguage(): Lang {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

// Detecta o idioma do navegador (ex.: "es-CL"/"es-419" → "es"). Retorna null
// para idiomas não suportados (pt/es/en), mantendo o padrão pt.
function detectBrowserLang(): Lang | null {
  if (typeof navigator === "undefined") return null;
  const raw = (navigator.languages && navigator.languages[0]) || navigator.language || "";
  const code = raw.split("-")[0].toLowerCase();
  if (code === "es") return "es";
  if (code === "en") return "en";
  if (code === "pt") return "pt";
  return null;
}

export function useTranslation() {
  const lang = useGlobalLanguage();

  // Hidrata o store global a partir das preferências salvas (idempotente).
  // Sem preferência salva (ex.: visitante não logado), cai no idioma do navegador.
  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.context?.language) {
          setLanguage(data.context.language as Lang);
        } else {
          const detected = detectBrowserLang();
          if (detected) setLanguage(detected);
        }
      })
      .catch(() => {});
  }, []);

  const translate = (key: string, vars?: Record<string, string>) =>
    t(lang, key, vars);

  return { lang, setLang: setLanguage, t: translate };
}
