import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, periodEndFromSubscription, subscriptionPriceInfo } from "@/lib/stripe";
import { logError } from "@/lib/error-log";
import { sendOryenEvent } from "@/lib/oryen";
import { sendAccessEmail } from "@/lib/email";

// Mapeia uma Stripe.Subscription para a linha da tabela `subscriptions`.
function subscriptionRow(sub: Stripe.Subscription, plan: string) {
  return {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
    stripe_subscription_id: sub.id,
    plan,
    status: sub.status,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end: periodEndFromSubscription(sub),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };
}

// Gera uma senha aleatória legível (sem caracteres ambíguos) para o primeiro acesso.
function generatePassword(len = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// Busca o id do usuário por email (listUsers paginado). Usado p/ idempotência na
// criação de conta do checkout — um retry do webhook não pode criar duplicado.
async function findUserIdByEmail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    const found = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (found) return found.id;
    if (users.length < 1000) break;
  }
  return null;
}

// POST /api/stripe/webhook — recebe eventos do Stripe e sincroniza a assinatura.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig || "", webhookSecret);
  } catch (error) {
    console.error("Webhook assinatura inválida:", error);
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // "dahlia": session.subscription pode vir como string ou como objeto
        // aninhado (parent.subscription_details.subscription).
        const rawSub = session.subscription as unknown;
        const subId: string | null =
          typeof rawSub === "string"
            ? rawSub
            : (rawSub as { id?: string } | null)?.id
              ?? (session as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription
              ?? null;

        // Fluxo antigo (usuário já logado) traz user_id no client_reference_id/metadata.
        let userId = session.client_reference_id || session.metadata?.user_id || null;

        // Fluxo novo (vindo do quiz/checkout, sem conta): cria o usuário a partir
        // do email do Stripe e envia os dados de acesso. Idempotente em retry.
        if (!userId) {
          const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
          const { data: existingSub } = subId
            ? await admin.from("subscriptions").select("user_id").eq("stripe_subscription_id", subId).maybeSingle()
            : { data: null };
          if (existingSub?.user_id) {
            userId = existingSub.user_id; // retry: conta já criada
          } else if (email) {
            userId = (await findUserIdByEmail(admin, email)) ?? null;
            if (!userId) {
              const password = generatePassword();
              const name = session.customer_details?.name?.trim().slice(0, 80) || undefined;
              const { data: created, error: createErr } = await admin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                ...(name ? { user_metadata: { name } } : {}),
              });
              if (createErr || !created.user) {
                console.error("checkout: falha ao criar conta:", createErr);
                throw createErr ?? new Error("Falha ao criar conta");
              }
              userId = created.user.id;
              // Fire-and-forget: não derruba o webhook se o email falhar.
              sendAccessEmail({ to: email, password, loginUrl: `${req.nextUrl.origin}/login` }).catch((e) => {
                logError({ path: "checkout-access-email", message: String(e) });
              });
            }
          }
        }

        if (!userId || !subId) {
          console.error("checkout.session.completed sem user_id/subscription:", { userId, subId });
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data"] });
        const { plan, amount_cents, currency } = subscriptionPriceInfo(sub);

        // Estado anterior para detectar a transição trial → pago (idempotente:
        // em retry do webhook o status já estará "active" e não dispara de novo).
        const { data: prev } = await admin
          .from("subscriptions")
          .select("status")
          .eq("user_id", userId)
          .maybeSingle();

        await admin.from("subscriptions").upsert(
          { user_id: userId, ...subscriptionRow(sub, plan) },
          { onConflict: "user_id" }
        );

        if (sub.status === "active" && (prev?.status ?? null) !== "active") {
          // Atribuição capturada no /api/checkout (metadata da sessão): browser + UTMs.
          const meta = session.metadata ?? {};
          sendOryenEvent("subscription.activated", {
            external_id: userId,
            email: session.customer_details?.email || session.customer_email || null,
            subscription_id: subId,
            plan,
            plan_status: "paid",
            stage: "active",
            amount_cents,
            currency,
            utm_source: meta.utm_source || null,
            utm_medium: meta.utm_medium || null,
            utm_campaign: meta.utm_campaign || null,
            utm_content: meta.utm_content || null,
            client: {
              ip: meta.client_ip || null,
              user_agent: meta.client_user_agent || null,
              fbc: meta.fbc || null,
              fbp: meta.fbp || null,
            },
            stage_changed_at: new Date().toISOString(),
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        let userId = sub.metadata?.user_id;
        if (!userId) {
          const { data: existing } = await admin
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", sub.id)
            .maybeSingle();
          if (!existing) {
            console.error("webhook: assinatura sem user_id no metadata e sem match no DB:", sub.id);
            break;
          }
          userId = existing.user_id;
        }

        // Estado anterior da assinatura do usuário — base para transições
        // idempotentes (churn, past_due, recuperação) e para o guard abaixo.
        const { data: prev } = await admin
          .from("subscriptions")
          .select("stripe_subscription_id, status")
          .eq("user_id", userId)
          .maybeSingle();

        // Evita que um evento de uma assinatura ANTIGA do usuário (ex.: uma sub
        // cancelada) sobrescreva o estado de uma assinatura mais nova e ativa.
        // Um usuário pode ter várias subs no Stripe (migração de preço, plano
        // antigo) — só a sub ativa deve mandar no status.
        if (sub.status !== "active" && prev?.status === "active" && prev.stripe_subscription_id !== sub.id) {
          break; // mantém a sub ativa; ignora evento de sub antiga/cancelada
        }

        // `current_period_end` (API dahlia) vive em items.data, que não vem
        // expandido no payload do webhook. Re-busca com items para não gravar
        // null (quebraria o aviso de "renovação próxima" no Perfil).
        let enriched = sub;
        try {
          enriched = await stripe.subscriptions.retrieve(sub.id, { expand: ["items.data"] });
        } catch { /* usa o objeto do evento se a re-busca falhar */ }

        const { plan, amount_cents, currency } = subscriptionPriceInfo(enriched);

        // Email do usuário para o evento (Oryen/Meta CAPI).
        let email: string | null = null;
        const { data: userData } = await admin.auth.admin.getUserById(userId);
        email = userData?.user?.email ?? null;

        await admin.from("subscriptions").upsert(
          { user_id: userId, ...subscriptionRow(enriched, plan) },
          { onConflict: "user_id" }
        );

        const prevStatus = prev?.status ?? null;
        const base = {
          external_id: userId,
          email,
          subscription_id: sub.id,
          plan,
          amount_cents,
          currency,
        };

        // Churn: cancelamento efetivo (sub deletada) → etapa "canceled".
        // Dispara só se o lead estava num estado real (ativo/trial/past_due),
        // ignorando retry do webhook e subs que nunca chegaram a valer.
        if (
          event.type === "customer.subscription.deleted" &&
          prevStatus !== null &&
          ["active", "trialing", "past_due"].includes(prevStatus)
        ) {
          sendOryenEvent("subscription.canceled", {
            ...base,
            plan_status: null,
            stage: "canceled",
            stage_changed_at: new Date().toISOString(),
          });
        }

        // Cobrança recusada → etapa "past_due". Idempotente com invoice.payment_failed
        // (o que rodar primeiro faz a transição; o outro não repete o evento).
        if (
          event.type === "customer.subscription.updated" &&
          sub.status === "past_due" &&
          prevStatus !== null &&
          prevStatus !== "past_due"
        ) {
          sendOryenEvent("subscription.past_due", {
            ...base,
            plan_status: "paid",
            stage: "past_due",
            stage_changed_at: new Date().toISOString(),
          });
        }

        // Recuperação: pagamento voltou a passar (past_due → active) → etapa "active".
        if (
          event.type === "customer.subscription.updated" &&
          sub.status === "active" &&
          prevStatus === "past_due"
        ) {
          sendOryenEvent("subscription.activated", {
            ...base,
            plan_status: "paid",
            stage: "active",
            stage_changed_at: new Date().toISOString(),
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        // Sinal direto de cobrança recusada → marca past_due (mesmo que a sub
        // ainda não tenha disparado customer.subscription.updated).
        const invoice = event.data.object as Stripe.Invoice;
        // API "dahlia" removeu invoice.subscription; a sub vem em parent.subscription_details.
        const subRef = invoice.parent?.subscription_details?.subscription ?? null;
        const subId = typeof subRef === "string" ? subRef : (subRef?.id ?? null);
        if (!subId) {
          console.error("invoice.payment_failed sem subscription:", invoice.id);
          break;
        }
        const { data: existing } = await admin
          .from("subscriptions")
          .select("user_id, status")
          .eq("stripe_subscription_id", subId)
          .maybeSingle();
        if (existing?.user_id) {
          await admin
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("user_id", existing.user_id);
          // Move o lead para "past_due". Idempotente: só na transição — a dunning
          // pode re-disparar este evento várias vezes (e o customer.subscription.updated
          // também cobre a transição; o que rodar primeiro dispara o evento).
          if (existing.status !== "past_due") {
            // Mesma carga do customer.subscription.updated: email + preço efetivo.
            let plan = "monthly";
            let amount_cents: number | null = null;
            let currency: string | null = null;
            try {
              const s = await stripe.subscriptions.retrieve(subId, { expand: ["items.data"] });
              const info = subscriptionPriceInfo(s);
              plan = info.plan;
              amount_cents = info.amount_cents;
              currency = info.currency;
            } catch { /* mantém defaults se a re-busca falhar */ }
            const { data: userData } = await admin.auth.admin.getUserById(existing.user_id);

            sendOryenEvent("subscription.past_due", {
              external_id: existing.user_id,
              email: userData?.user?.email ?? null,
              subscription_id: subId,
              plan,
              plan_status: "paid",
              stage: "past_due",
              amount_cents,
              currency,
              stage_changed_at: new Date().toISOString(),
            });
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    logError({ path: "api/stripe/webhook", message: String(error), status: 500 });
    return NextResponse.json({ error: "Erro ao processar webhook" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
