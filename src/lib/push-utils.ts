import { getLanguage } from "@/lib/language";
import { t as tFn } from "@/lib/i18n";

/** Register the service worker and return the registration, or null if unsupported. */
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");

    // Detect new version waiting
    if (reg.waiting) {
      notifyUpdate();
    }
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          notifyUpdate();
        }
      });
    });

    // Also check periodically for updates (every 60 min)
    setInterval(() => {
      reg.update().catch(() => {});
    }, 60 * 60 * 1000);

    return null;
  } catch {
    return null;
  }
}

function notifyUpdate() {
  // Show a subtle toast or banner — skip if already shown this session
  if (sessionStorage.getItem("sw_update_shown")) return;
  sessionStorage.setItem("sw_update_shown", "1");

  // Use a small non-blocking banner
  const banner = document.createElement("div");
  banner.style.cssText = `
    position:fixed;bottom:100px;left:16px;right:16px;z-index:9999;
    background:#7C5CFF;color:#fff;border-radius:14px;padding:14px 18px;
    font-family:system-ui,sans-serif;font-size:13px;font-weight:600;
    text-align:center;box-shadow:0 4px 20px rgba(124,92,255,0.5);
    cursor:pointer;animation:swSlideUp .3s ease;
  `;
  banner.textContent = tFn(getLanguage(), "sw_nova_versao");
  banner.addEventListener("click", () => {
    window.location.reload();
  });
  document.body.appendChild(banner);

  // Auto-remove after 10s
  setTimeout(() => banner.remove(), 10000);

  // Add animation style
  if (!document.getElementById("sw-update-style")) {
    const style = document.createElement("style");
    style.id = "sw-update-style";
    style.textContent = "@keyframes swSlideUp {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}";
    document.head.appendChild(style);
  }
}

/** Returns true if push is supported and permission is already granted. */
export function hasPushPermission(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && Notification.permission === "granted";
}

/** Converts a VAPID public key (base64url) to an ArrayBuffer for the PushManager. */
export function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray.buffer;
}

/**
 * Request push permission and create a subscription.
 * Registers the SW, waits for it to become active (navigator.serviceWorker.ready),
 * then subscribes. Returns { sub, error } — sub is null on failure.
 */
export async function requestPushSubscription(): Promise<{ sub: PushSubscription | null; error: string | null }> {
  if (typeof window === "undefined") return { sub: null, error: "SSR" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return { sub: null, error: tFn(getLanguage(), "push_nao_suportado") };

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { sub: null, error: tFn(getLanguage(), "push_vapid_nao_configurada") };

  try {
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    return { sub, error: null };
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("Push subscription failed:", msg);
    return { sub: null, error: msg };
  }
}
