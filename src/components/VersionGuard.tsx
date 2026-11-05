"use client";

import { useEffect, useRef } from "react";
import { BUILD_VERSION } from "@/lib/version";

const RELOADED_FOR_KEY = "maya_reloaded_for";

/**
 * Recarrega a página quando um deploy novo entra no ar, evitando que o usuário
 * continue rodando um bundle antigo em cache — causa das duplicações e estados
 * estranhos logo após deploys. Compara o build do cliente com /api/version.
 */
export function VersionGuard() {
  const checkingRef = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        const serverVersion = data.version;

        // Sem versão válida (dev/local) ou já no build atual → nada a fazer.
        if (!serverVersion || serverVersion === "local" || serverVersion === BUILD_VERSION) return;

        // Recarrega UMA vez por versão detectada — evita loop se o build não
        // puder bater (ex.: env ausente no servidor).
        if (sessionStorage.getItem(RELOADED_FOR_KEY) === serverVersion) return;
        sessionStorage.setItem(RELOADED_FOR_KEY, serverVersion);
        window.location.reload();
      } catch {
        /* sem rede — ignora */
      } finally {
        checkingRef.current = false;
      }
    };

    check();
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    const interval = setInterval(check, 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      clearInterval(interval);
    };
  }, []);

  return null;
}
