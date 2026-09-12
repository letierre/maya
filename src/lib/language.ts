"use client";

import { useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n";

// Store reativo global de idioma. Permite que qualquer mudança de idioma
// (onboarding ou menu do perfil) re-renderize na hora todos os componentes
// que usam `useTranslation`, sem precisar navegar de novo.
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

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useGlobalLanguage(): Lang {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}
