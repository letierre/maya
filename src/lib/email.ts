import { tUser } from "@/lib/server-i18n";

/**
 * Envia o código de verificação por email via Resend (HTTP API direto, sem
 * dependência extra). `RESEND_DOMAIN` é o domínio verificado no Resend — vira
 * o domínio do endereço `from`.
 */
export async function sendVerificationCodeEmail(opts: {
  to: string;
  code: string;
  lang?: string;
}): Promise<void> {
  const from = `Maya <no-reply@${process.env.RESEND_DOMAIN}>`;
  const subject = tUser(opts.lang, "otp_email_subject");
  const html = tUser(opts.lang, "otp_email_body", { code: opts.code });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: opts.to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}
