import crypto from "node:crypto";
import { logError } from "@/lib/error-log";

// Envio de eventos para a Oryen Systems (back-office) via webhook assinado.
// - Assinatura: HMAC-SHA256 (hex) do BODY cru, no header X-Maya-Signature.
// - Timestamp: segundos unix (Math.floor(Date.now()/1000)) no header X-Maya-Timestamp.
// - Envio assíncrono (fire-and-forget): nunca bloqueia o fluxo de signup.
// - Em caso de falha, loga o erro e faz 1 retry após 2s.
// - Segredo NUNCA hardcoded: lê ORYEN_WEBHOOK_URL / ORYEN_WEBHOOK_SECRET / ORYEN_ORG_ID do env.

export interface OryenEventData {
  external_id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  plan?: string | null;
  plan_status: "trial" | "paid";
  utm_source?: string | null;
  utm_campaign?: string | null;
}

const RETRY_DELAY_MS = 2_000;

function signBody(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// Envia o POST e lança se não configurado ou se a Oryen responder fora de 2xx.
async function postOryen(event: string, body: string): Promise<void> {
  const url = process.env.ORYEN_WEBHOOK_URL;
  const secret = process.env.ORYEN_WEBHOOK_SECRET;
  if (!url || !secret) throw new Error("ORYEN_WEBHOOK_URL/SECRET não configurados");

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signBody(body, secret);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Maya-Timestamp": timestamp,
      "X-Maya-Signature": signature,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Oryen respondeu ${res.status}: ${text.slice(0, 300)}`);
  }
}

/**
 * Dispara um evento para a Oryen de forma assíncrona (não bloqueia o chamador).
 * Serializa UMA única string que é usada tanto para assinar quanto para o body,
 * garantindo que a assinatura corresponde exatamente ao que é enviado.
 */
export function sendOryenEvent(event: string, data: OryenEventData): void {
  const url = process.env.ORYEN_WEBHOOK_URL;
  const secret = process.env.ORYEN_WEBHOOK_SECRET;
  if (!url || !secret) {
    // Ainda não configurado (ex.: ambiente sem Oryen) → não envia, avisa uma vez.
    console.warn(`[oryen] webhook não configurado (URL/secret ausente) — evento "${event}" ignorado`);
    return;
  }

  const payload = { org_id: process.env.ORYEN_ORG_ID ?? null, event, data };
  const body = JSON.stringify(payload);

  void (async () => {
    try {
      await postOryen(event, body);
    } catch (err) {
      logError({ path: "oryen-webhook", message: `1ª tentativa falhou (${event}): ${String(err)}` });
      // 1 retry simples após 2s
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      try {
        await postOryen(event, body);
      } catch (err2) {
        logError({ path: "oryen-webhook", message: `retry falhou (${event}): ${String(err2)}` });
      }
    }
  })();
}
