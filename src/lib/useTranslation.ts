"use client";

import { useEffect } from "react";
import { t, type Lang } from "@/lib/i18n";
import { useGlobalLanguage, setLanguage } from "@/lib/language";

export function useTranslation() {
  const lang = useGlobalLanguage();

  // Hidrata o store global a partir das preferências salvas (idempotente).
  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.context?.language) {
          setLanguage(data.context.language as Lang);
        }
      })
      .catch(() => {});
  }, []);

  const translate = (key: string, vars?: Record<string, string>) =>
    t(lang, key, vars);

  return { lang, setLang: setLanguage, t: translate };
}
