/**
 * Cache simples em memória para GET requests.
 * Evita refetch ao revisitar uma página durante a navegação.
 * TTL curto (30s) para manter dados frescos.
 */

import { emitCareDataChanged } from "./care-events";

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 30_000; // 30 segundos

export function clearFetchCache() {
  cache.clear();
}

export function invalidateFetchCache(pattern: string) {
  let changed = false;
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      changed = true;
    }
  }
  // Avisa componentes (ex.: CareList) que dados podem ter mudado,
  // para que re-busquem em tempo real.
  if (changed) emitCareDataChanged();
}

export async function cachedFetch<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  // Só cacheia GET
  const method = (options?.method || "GET").toUpperCase();
  if (method !== "GET") {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < TTL) {
    return cached.data as T;
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    // Se tem cache antigo, retorna ele como fallback
    if (cached) return cached.data as T;
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}

// Versão que nunca rejeita — retorna null em caso de erro (útil para dados opcionais)
export async function safeCachedFetch<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T | null> {
  try {
    return await cachedFetch<T>(url, options);
  } catch {
    return null;
  }
}
