import type { Lang } from "@/lib/i18n";

// Store reativo global de idioma (módulo puro, sem React).
// Permite que qualquer mudança de idioma re-renderize na hora todos os
// componentes que usam `useTranslation`, e fornece o locale certo p/ datas.
let current: Lang = "pt";
const listeners = new Set<() => void>();

export function getLanguage(): Lang {
  return current;
}

export function setLanguage(lang: Lang): void {
  if (current === lang) return;
  current = lang;
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function localeForLang(lang: Lang): string {
  if (lang === "es") return "es";
  if (lang === "en") return "en-US";
  return "pt-BR";
}

export function getLocale(): string {
  return localeForLang(getLanguage());
}
