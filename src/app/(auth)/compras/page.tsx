"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cachedFetch, invalidateFetchCache } from "@/lib/fetch-cache";
import { toast } from "sonner";
import { Plus, X, ShoppingCart } from "lucide-react";
import type { ShoppingItem, ShoppingList } from "@/types";

const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const FOREGROUND = "#e0d6ff";

const EMOJIS = ["🛒", "🍎", "🏠", "🛋️", "🧺", "🎁", "📦", "👕", "🧴", "💊", "🐶", "✈️"];

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ComprasPage() {
  const router = useRouter();

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🛒");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, i] = await Promise.all([
        cachedFetch<ShoppingList[]>("/api/shopping-lists"),
        cachedFetch<ShoppingItem[]>("/api/shopping-list"),
      ]);
      if (Array.isArray(l)) setLists(l);
      if (Array.isArray(i)) setItems(i);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const map = new Map<string, { pending: number; done: number; total: number }>();
    for (const l of lists) map.set(l.id, { pending: 0, done: 0, total: 0 });
    for (const it of items) {
      const s = map.get(it.list_id) || { pending: 0, done: 0, total: 0 };
      if (it.checked) s.done++;
      else {
        s.pending++;
        if (it.estimated_price) s.total += it.estimated_price;
      }
      map.set(it.list_id, s);
    }
    return map;
  }, [lists, items]);

  const createList = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/shopping-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emoji: newEmoji }),
      });
      if (!res.ok) throw new Error();
      setShowNew(false);
      setNewName("");
      setNewEmoji("🛒");
      invalidateFetchCache("/api/shopping-lists");
      await load();
    } catch {
      toast.error("Erro ao criar lista");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-x-hidden pb-32"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.47 .18 270 / .20) 0%, transparent 50%),
          radial-gradient(ellipse 100% 60% at 100% 100%, oklch(.5 .14 270 / .15) 0%, transparent 60%),
          linear-gradient(180deg, oklch(0.12 0.012 270) 0%, oklch(0.10 0.012 270) 100%)
        `,
      }}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Suas listas</p>
            <h1 className="mt-1 text-[36px] font-bold tracking-tight leading-[1.05]">Compras</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {loading ? "..." : `${lists.length} ${lists.length === 1 ? "lista" : "listas"}`}
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!loading && lists.length === 0 && (
        <div className="px-8 pt-14 pb-20 text-center">
          <div className="text-5xl mb-4">🛒</div>
          <h2 className="text-lg font-bold mb-2">Nenhuma lista ainda</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Crie listas para o mercado, a casa, móveis ou o que você precisar comprar.
          </p>
          <p className="text-xs text-muted-foreground mt-6">Toque no <strong>+</strong> abaixo pra começar</p>
        </div>
      )}

      {/* Lista de listas */}
      <div className="px-4 pt-3 flex flex-col gap-2">
        {lists.map((list) => {
          const s = stats.get(list.id) || { pending: 0, done: 0, total: 0 };
          const total = s.pending + s.done;
          const pct = total > 0 ? Math.round((s.done / total) * 100) : 0;
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => router.push(`/compras/${list.id}`)}
              className="w-full text-left transition-transform active:scale-[0.99]"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 16,
                border: "1px solid rgba(167,139,250,0.12)",
                background: "#1a1530", cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{list.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: FOREGROUND, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {list.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <div style={{ flex: 1, maxWidth: 160, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.12)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: PURPLE_HEX }} />
                  </div>
                  <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>
                    {s.pending} pendente{s.pending !== 1 ? "s" : ""}
                    {s.done > 0 && ` · ${s.done} ✓`}
                  </span>
                </div>
              </div>
              {s.total > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#5EEAD4", whiteSpace: "nowrap" }}>
                  {fmtBRL(s.total)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* FAB — nova lista */}
      <div className="fixed bottom-20 right-5 z-40">
        <button
          type="button"
          onClick={() => setShowNew(true)}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: PURPLE_HEX, border: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
          }}
          aria-label="Nova lista"
        >
          <Plus size={24} color="#fff" />
        </button>
      </div>

      {/* Sheet — nova lista */}
      {showNew && (
        <div
          onClick={() => setShowNew(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480, background: "#151520",
              borderRadius: "24px 24px 0 0", padding: "20px 20px max(24px, env(safe-area-inset-bottom))",
              border: "1px solid rgba(167,139,250,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: FOREGROUND }}>Nova lista</span>
              <button type="button" onClick={() => setShowNew(false)}
                style={{ background: "none", border: 0, color: MUTED, fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>
                <X size={18} />
              </button>
            </div>

            {/* Emoji */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setNewEmoji(e)}
                  style={{
                    width: 40, height: 40, borderRadius: 12, fontSize: 20,
                    background: newEmoji === e ? "rgba(124,92,255,0.2)" : "transparent",
                    border: newEmoji === e ? `1.5px solid ${PURPLE_HEX}` : "1px solid rgba(167,139,250,0.12)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createList()}
              placeholder="Nome da lista (ex.: Mercado, Casa nova...)"
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12,
                border: "1px solid rgba(167,139,250,0.25)", background: "#0B0B10", color: FOREGROUND,
                fontSize: 14, fontFamily: "inherit", outline: "none",
              }}
            />

            <button
              type="button"
              onClick={createList}
              disabled={creating || !newName.trim()}
              style={{
                width: "100%", marginTop: 12, padding: "13px", borderRadius: 12, border: 0,
                background: newName.trim() ? PURPLE_HEX : "#1e1840", color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: newName.trim() ? "pointer" : "not-allowed", fontFamily: "inherit",
              }}
            >
              {creating ? "Criando..." : "Salvar lista"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
