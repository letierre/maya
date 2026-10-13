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

/** Envia os dados de acesso (email + senha) após a primeira compra. */
export async function sendAccessEmail(opts: {
  to: string;
  password: string;
  loginUrl: string;
}): Promise<void> {
  const from = `Maya <no-reply@${process.env.RESEND_DOMAIN}>`;
  const subject = "Seu acesso à Maya ✨";
  const html = `
    <div style="font-family:sans-serif;color:#0F0F14;line-height:1.6;max-width:520px">
      <h2 style="margin:0 0 12px">Bem-vindo(a) à Maya</h2>
      <p>Seu pagamento foi confirmado e sua conta já está pronta.</p>
      <p style="margin:16px 0"><strong>Seus dados de acesso:</strong></p>
      <p style="background:#f4f2ff;border-radius:8px;padding:14px 16px;margin:0 0 16px">
        Email: <strong>${opts.to}</strong><br />
        Senha: <strong>${opts.password}</strong>
      </p>
      <p><a href="${opts.loginUrl}" style="color:#7C5CFF;font-weight:600">Entrar na Maya</a></p>
      <p style="color:#6b7280;font-size:13px">Você pode trocar a senha depois do primeiro acesso, no seu perfil.</p>
    </div>`;

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
