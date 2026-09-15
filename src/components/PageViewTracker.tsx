"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Mapeia o 1º segmento da rota para o rótulo do módulo registrado em `app_events`.
const MODULE_BY_SEGMENT: Record<string, string> = {
  "": "Landing",
  cadastro: "Cadastro",
  login: "Login",
  onboarding: "Onboarding",
  assinar: "Assinar",
  agenda: "Agenda/Plano",
  "check-in": "Check-in",
  diario: "Diário",
  nutricao: "Nutrição",
  sono: "Sono",
  financas: "Finanças",
  leitura: "Leitura",
  corrida: "Corrida",
  metas: "Metas",
  comunidade: "Comunidade",
  analise: "Análise",
  perfil: "Perfil",
  compras: "Compras",
  historico: "Histórico",
  porques: "Porquês",
  "configurações": "Configurações",
  dashboard: "Dashboard",
  admin: "Admin",
  insights: "Maya (chat)",
};

// Dispara um pageview (fire-and-forget) a cada navegação. A rota /api/track
// ignora sessões anônimas — então só usuários logados geram registros.
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const seg = (pathname ?? "").split("/")[1] ?? "";
    const module = MODULE_BY_SEGMENT[seg] ?? (seg || "Landing");
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ module, path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
