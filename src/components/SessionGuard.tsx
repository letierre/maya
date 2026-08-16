"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Detecta sessão expirada enquanto o usuário está numa página autenticada:
 * se qualquer chamada a `/api/*` retornar 401, redireciona para o login.
 * Complementa o middleware (que cobre navegações/reloads).
 */
export function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let redirecting = false;

    window.fetch = async (input, init) => {
      const res = await originalFetch(input, init);

      let raw = "";
      if (typeof input === "string") raw = input;
      else if (input instanceof URL) raw = input.href;
      else if (input instanceof Request) raw = input.url;

      const path = raw.startsWith("/")
        ? raw
        : (() => {
            try {
              return new URL(raw, window.location.origin).pathname;
            } catch {
              return "";
            }
          })();

      if (res.status === 401 && path.startsWith("/api/") && !redirecting) {
        redirecting = true;
        router.replace("/login");
      }

      return res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  return null;
}
