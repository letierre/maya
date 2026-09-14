// Captura e persistência de atribuição de tráfego (UTM / cliques de anúncio).
// Armazenado em localStorage no primeiro contato (landing ou cadastro) e lido
// ao concluir o onboarding, para gravar em onboarding_responses.utm_source/campaign.

const KEY = "maya_attribution";

export const UTM_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

export type Attribution = Partial<Record<(typeof UTM_FIELDS)[number], string>>;

/** Lê o que já foi capturado (ou {} se nada/vazio). */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

/** Captura os parâmetros de UTM/click da URL atual e mescla com o que já existe.
 *  Campos presentes na URL sobrescrevem os antigos; campos ausentes são mantidos. */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const sp = new URLSearchParams(window.location.search);
    const stored = getAttribution();
    let changed = false;
    for (const field of UTM_FIELDS) {
      const value = sp.get(field);
      if (value) {
        stored[field] = value;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* localStorage indisponível — ignora silenciosamente */
  }
}
