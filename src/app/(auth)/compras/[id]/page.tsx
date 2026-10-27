"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cachedFetch, invalidateFetchCache } from "@/lib/fetch-cache";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, X, Trash2, CheckSquare, Square, Minus, GripVertical, Pencil, Star,
} from "lucide-react";
import type { ShoppingItem, ShoppingList } from "@/types";
import { parseQuantity, lineMultiplier, lineTotal } from "@/lib/shopping-quantity";
import { useTranslation } from "@/lib/useTranslation";

const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const FOREGROUND = "#e0d6ff";
const DARK_CARD = "oklch(.17 .015 270 / .6)";
const ITEM_GAP = 4;

const EMOJIS = ["🛒", "🍎", "🏠", "🛋️", "🧺", "🎁", "📦", "👕", "🧴", "💊", "🐶", "✈️"];

const CURRENCY_CONFIG: Record<string, { locale: string; code: string }> = {
  BRL: { locale: "pt-BR", code: "BRL" },
  USD: { locale: "en-US", code: "USD" },
  EUR: { locale: "de-DE", code: "EUR" },
  GBP: { locale: "en-GB", code: "GBP" },
  ARS: { locale: "es-AR", code: "ARS" },
  CLP: { locale: "es-CL", code: "CLP" },
  MXN: { locale: "es-MX", code: "MXN" },
};

const fmt = (n: number, currency = "BRL") => {
  const conf = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.BRL;
  try {
    return new Intl.NumberFormat(conf.locale, { style: "currency", currency: conf.code }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

const SYMBOL: Record<string, string> = {
  BRL: "R$", USD: "$", EUR: "€", GBP: "£", ARS: "$", CLP: "$", MXN: "$",
};

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export default function ComprasListaPage() {
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;
  const { t } = useTranslation();

  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("un");
  const [priority, setPriority] = useState(false);
  const [adding, setAdding] = useState(false);

  // Selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit item sheet
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editUnit, setEditUnit] = useState("un");
  const [editPriority, setEditPriority] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // List meta sheet (rename / emoji)
  const [showMeta, setShowMeta] = useState(false);
  const [metaName, setMetaName] = useState("");
  const [metaEmoji, setMetaEmoji] = useState("🛒");
  const [savingMeta, setSavingMeta] = useState(false);

  // Moeda do perfil
  const [currency, setCurrency] = useState("BRL");

  const nameRef = useRef<HTMLInputElement>(null);

  // ── Drag state ──────────────────────────────────────────────
  const listRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const itemRects = useRef<{ top: number; height: number }[]>([]);
  const drag = useRef({ active: false, fromIndex: -1, overIndex: -1, pointerId: -1, startY: 0 });
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);
  const [dragDelta, setDragDelta] = useState(0);

  const loadList = useCallback(async () => {
    try {
      const data = await cachedFetch<ShoppingList[]>("/api/shopping-lists");
      if (Array.isArray(data)) {
        const found = data.find((l) => l.id === listId) || null;
        setList(found);
        if (found) {
          setMetaName(found.name);
          setMetaEmoji(found.emoji);
        }
      }
    } catch {
      // silent
    }
  }, [listId]);

  const loadItems = useCallback(async () => {
    try {
      const data = await cachedFetch<ShoppingItem[]>(`/api/shopping-list?listId=${listId}`);
      if (Array.isArray(data)) setItems(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    loadList();
    loadItems();
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((p) => { if (p?.context?.currency) setCurrency(p.context.currency); })
      .catch(() => {});
  }, [loadList, loadItems]);

  const persistOrder = useCallback(async (ordered: ShoppingItem[]) => {
    const payload = ordered.map((item, i) => ({ id: item.id, position: i }));
    try {
      await fetch("/api/shopping-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: payload }),
      });
    } catch {
      // silent
    }
  }, []);

  const cacheRects = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const children = el.querySelectorAll<HTMLElement>("[data-drag-row]");
    itemRects.current = [];
    children.forEach((child) => {
      const r = child.getBoundingClientRect();
      itemRects.current.push({ top: r.top, height: r.height });
    });
  }, []);

  const getOverIndex = useCallback((clientY: number): number => {
    const rects = itemRects.current;
    if (rects.length === 0) return drag.current.fromIndex;
    let bestIdx = drag.current.fromIndex;
    let bestDist = Infinity;
    for (let i = 0; i < rects.length; i++) {
      const mid = rects[i].top + rects[i].height / 2;
      const dist = Math.abs(clientY - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (selectionMode) return;
    e.preventDefault();
    e.stopPropagation();
    cacheRects();
    drag.current = { active: true, fromIndex: index, overIndex: index, pointerId: e.pointerId, startY: e.clientY };
    setDragFrom(index);
    setDragTo(index);
    setDragDelta(0);
    try { (e.target as HTMLElement).closest("[data-drag-row]")?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, [selectionMode, cacheRects]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    e.preventDefault();
    const delta = e.clientY - d.startY;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setDragDelta(delta);
      const over = getOverIndex(e.clientY);
      if (over !== d.overIndex) {
        d.overIndex = over;
        setDragTo(over);
      }
    });
  }, [getOverIndex]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    e.preventDefault();
    cancelAnimationFrame(rafRef.current);
    const from = d.fromIndex;
    const to = d.overIndex;
    d.active = false;
    setDragFrom(null);
    setDragTo(null);
    setDragDelta(0);
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }

    if (from !== to && from >= 0 && to >= 0) {
      setItems((prev) => {
        const reordered = reorder(prev, from, to).map((item, i) => ({ ...item, position: i }));
        persistOrder(reordered);
        return reordered;
      });
    }
  }, [persistOrder]);

  // ── Add ──────────────────────────────────────────────────────
  const handleAdd = async () => {
    const n = name.trim();
    if (!n || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_id: listId,
          item_name: n,
          quantity: quantity.trim() || null,
          quantity_unit: unit || null,
          note: note.trim() || null,
          estimated_price: price.trim() ? price.trim().replace(",", ".") : null,
          priority,
        }),
      });
      if (!res.ok) throw new Error();
      const created = (await res.json()) as ShoppingItem;
      if (!created?.id) throw new Error();
      setName(""); setQuantity(""); setNote(""); setPrice(""); setPriority(false); setUnit("un");
      // Insere no topo na hora (sem re-buscar) e persiste a ordem para o reload bater.
      const next = [created, ...items];
      setItems(next);
      persistOrder(next);
      invalidateFetchCache(`/api/shopping-list?listId=${listId}`);
      invalidateFetchCache("/api/shopping-list");
      nameRef.current?.focus();
    } catch {
      toast.error(t("cp_erro_adicionar"));
    } finally {
      setAdding(false);
    }
  };

  // Leva o usuário ao campo de adicionar (FAB) — rola e foca no input.
  const focusAdd = () => {
    nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    nameRef.current?.focus({ preventScroll: true });
  };

  // ── Toggle ───────────────────────────────────────────────────
  const handleToggle = async (item: ShoppingItem) => {
    if (selectionMode || drag.current.active) return;
    const newChecked = !item.checked;
    const updated = items.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i));
    const ordered = [...updated.filter((i) => !i.checked), ...updated.filter((i) => i.checked)];
    setItems(ordered);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, checked: newChecked }),
      });
      if (!res.ok) throw new Error();
      await persistOrder(ordered);
    } catch {
      loadItems();
    }
  };

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm(t("cp_excluir_item_confirm"))) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/shopping-list?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      invalidateFetchCache("/api/shopping-list");
    } catch {
      toast.error(t("cp_erro_remover"));
      loadItems();
    }
  };

  const handleClearChecked = async () => {
    const checked = items.filter((i) => i.checked);
    if (checked.length === 0) return;
    // Desmarca e reordena por posição, para os itens voltarem ao topo (não-concluídos).
    setItems((prev) =>
      prev
        .map((i) => (i.checked ? { ...i, checked: false } : i))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    );
    let failed = false;
    for (const item of checked) {
      try {
        const res = await fetch("/api/shopping-list", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, checked: false }),
        });
        if (!res.ok) failed = true;
      } catch {
        failed = true;
      }
    }
    if (failed) {
      toast.error(t("cp_erro_desmarcar"));
      loadItems();
    }
  };

  // ── Selection ────────────────────────────────────────────────
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(items.map((i) => i.id)));
  const deselectAll = () => setSelectedIds(new Set());
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const toDelete = [...selectedIds];
    setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
    setSelectedIds(new Set());
    setSelectionMode(false);
    let failed = false;
    for (const id of toDelete) {
      try {
        const res = await fetch(`/api/shopping-list?id=${id}`, { method: "DELETE" });
        if (!res.ok) failed = true;
      } catch {
        failed = true;
      }
    }
    invalidateFetchCache("/api/shopping-list");
    if (failed) {
      toast.error(t("cp_erro_remover_alguns"));
      loadItems();
    } else {
      toast.success(`${toDelete.length} ${t("cp_itens_removidos")}`);
    }
  };
  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  // ── Edit item ────────────────────────────────────────────────
  const openEdit = (item: ShoppingItem) => {
    const pq = parseQuantity(item.quantity, item.quantity_unit);
    setEditing(item);
    setEditName(item.item_name);
    setEditQuantity(pq.num);
    setEditUnit(pq.unit ?? "un");
    setEditNote(item.note || "");
    setEditPrice(item.estimated_price != null ? String(item.estimated_price) : "");
    setEditPriority(item.priority);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const n = editName.trim();
    if (!n || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          item_name: n,
          quantity: editQuantity.trim() || null,
          quantity_unit: editUnit || null,
          note: editNote.trim() || null,
          estimated_price: editPrice.trim() ? editPrice.trim().replace(",", ".") : null,
          priority: editPriority,
        }),
      });
      if (!res.ok) throw new Error();
      setEditing(null);
      invalidateFetchCache(`/api/shopping-list?listId=${listId}`);
      invalidateFetchCache("/api/shopping-list");
      await loadItems();
    } catch {
      toast.error(t("cp_erro_salvar"));
    } finally {
      setSavingEdit(false);
    }
  };

  // ── List meta ────────────────────────────────────────────────
  const saveMeta = async () => {
    const n = metaName.trim();
    if (!n || savingMeta) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/shopping-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, emoji: metaEmoji }),
      });
      if (!res.ok) throw new Error();
      setShowMeta(false);
      invalidateFetchCache("/api/shopping-lists");
      await loadList();
    } catch {
      toast.error(t("cp_erro_salvar_lista"));
    } finally {
      setSavingMeta(false);
    }
  };

  const deleteList = async () => {
    if (!confirm(t("cp_excluir_lista_confirm", { name: list?.name || "" }))) return;
    try {
      const res = await fetch(`/api/shopping-lists/${listId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      invalidateFetchCache("/api/shopping-lists");
      invalidateFetchCache("/api/shopping-list");
      toast.success(t("cp_lista_excluida"));
      router.push("/compras");
    } catch {
      toast.error(t("cp_erro_excluir_lista"));
    }
  };

  // ── Unidade / total ─────────────────────────────────────────
  const unitLabel = (u: string | null) => {
    switch (u) {
      case "un": return t("cp_unit_un");
      case "pct": return t("cp_unit_pct");
      case "g": return t("cp_unit_g");
      case "kg": return t("cp_unit_kg");
      case "ml": return t("cp_unit_ml");
      case "l": return t("cp_unit_l");
      default: return "";
    }
  };

  const UNIT_OPTIONS: { value: string; label: string }[] = [
    { value: "un", label: t("cp_unit_un") },
    { value: "pct", label: t("cp_unit_pct") },
    { value: "g", label: t("cp_unit_g") },
    { value: "kg", label: t("cp_unit_kg") },
    { value: "ml", label: t("cp_unit_ml") },
    { value: "l", label: t("cp_unit_l") },
  ];

  const toNumber = (s: string) => {
    const n = parseFloat(s.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const addPriceNum = toNumber(price);
  const addMultiplier = lineMultiplier(quantity, unit);
  const addLineTotal = addPriceNum != null ? addPriceNum * addMultiplier : null;

  const editPriceNum = toNumber(editPrice);
  const editMultiplier = lineMultiplier(editQuantity, editUnit);
  const editLineTotal = editPriceNum != null ? editPriceNum * editMultiplier : null;

  // ── Derived ──────────────────────────────────────────────────
  const uncheckedCount = items.filter((i) => !i.checked).length;
  const checkedCount = items.filter((i) => i.checked).length;
  const projected = items
    .filter((i) => !i.checked && i.estimated_price != null)
    .reduce((s, i) => s + lineTotal(i.estimated_price, i.quantity, i.quantity_unit), 0);
  const purchased = items
    .filter((i) => i.checked && i.estimated_price != null)
    .reduce((s, i) => s + lineTotal(i.estimated_price, i.quantity, i.quantity_unit), 0);
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden pb-32"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.47 .18 270 / .20) 0%, transparent 50%),
          linear-gradient(180deg, oklch(0.12 0.012 270) 0%, oklch(0.10 0.012 270) 100%)
        `,
      }}
    >
      {/* Header */}
      <div className="px-4 pt-6 pb-1">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <button
              type="button"
              onClick={() => router.push("/compras")}
              style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA" }}
            >
              <ArrowLeft size={18} />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: FOREGROUND, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {list ? `${list.emoji} ${list.name}` : t("cp_carregando")}
              </h1>
              {list && (
                <p style={{ margin: "1px 0 0", fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {uncheckedCount} {uncheckedCount !== 1 ? t("cp_pendentes") : t("cp_pendente")} · {checkedCount} {checkedCount !== 1 ? t("cp_concluidos") : t("cp_concluido")}
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={() => setShowMeta(true)}
            style={{ height: 34, padding: "0 12px", borderRadius: 10, flexShrink: 0, background: "transparent", border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer", color: "#A78BFA", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {t("editar")}
          </button>
        </div>
      </div>

      {/* Add form */}
      <div style={{ padding: "16px 20px 8px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={t("cp_adicionar_placeholder")}
            style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${BORDER}`, background: "oklch(.18 .015 270 / .5)", color: FOREGROUND, fontSize: 14, fontFamily: "inherit", padding: "0 14px", outline: "none", boxSizing: "border-box" }}
          />
          <button type="button" onClick={handleAdd} disabled={adding || !name.trim()}
            style={{ width: 44, height: 44, borderRadius: 12, border: 0, cursor: "pointer", background: name.trim() ? PURPLE_HEX : "oklch(.22 .015 270 / .5)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", opacity: name.trim() ? 1 : 0.4, flexShrink: 0 }}>
            <Plus size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder={t("cp_quantidade_placeholder")}
              style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 10, border: `1px solid ${BORDER}`, background: "oklch(.18 .015 270 / .5)", color: FOREGROUND, fontSize: 13, fontFamily: "inherit", padding: "0 12px", outline: "none", boxSizing: "border-box" }} />
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 10, border: `1px solid ${BORDER}`, background: "oklch(.18 .015 270 / .5)", color: FOREGROUND, fontSize: 13, fontFamily: "inherit", padding: "0 8px", outline: "none", boxSizing: "border-box" }}>
              {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder={`${t("cp_preco")} (${SYMBOL[currency] ?? currency})`}
            style={{ height: 40, borderRadius: 10, border: `1px solid ${BORDER}`, background: "oklch(.18 .015 270 / .5)", color: FOREGROUND, fontSize: 13, fontFamily: "inherit", padding: "0 12px", outline: "none", boxSizing: "border-box" }} />
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder={t("cp_nota_placeholder")}
            style={{ height: 40, borderRadius: 10, border: `1px solid ${BORDER}`, background: "oklch(.18 .015 270 / .5)", color: FOREGROUND, fontSize: 13, fontFamily: "inherit", padding: "0 12px", outline: "none", boxSizing: "border-box" }} />
          <button type="button" onClick={() => setPriority(!priority)}
            style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: priority ? "#fbbf24" : MUTED, padding: 0 }}>
            <Star size={15} fill={priority ? "#fbbf24" : "none"} /> {t("cp_prioritario")}
          </button>
          {addLineTotal != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ color: MUTED }}>{t("cp_item_total")}:</span>
              <span style={{ color: "#5EEAD4", fontWeight: 700 }}>{fmt(addLineTotal, currency)}</span>
              {addMultiplier > 1 && (
                <span style={{ color: MUTED }}>· {addMultiplier} × {fmt(addPriceNum!, currency)}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {!loading && items.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 20px 8px", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: MUTED }}>{uncheckedCount} {uncheckedCount !== 1 ? t("cp_pendentes") : t("cp_pendente")}{checkedCount > 0 && ` · ${checkedCount} ${checkedCount > 1 ? t("cp_concluidos") : t("cp_concluido")}`}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {!selectionMode ? (
              <>
                <button type="button" onClick={() => setSelectionMode(true)} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11, color: MUTED, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckSquare size={12} />{t("cp_selecionar")}
                </button>
                {checkedCount > 0 && (
                  <button type="button" onClick={handleClearChecked} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11, color: MUTED, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Minus size={12} />{t("cp_limpar_concluidos")}
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" onClick={allSelected ? deselectAll : selectAll} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11, color: MUTED, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Square size={12} />{allSelected ? t("cp_desmarcar_todos") : t("cp_selecionar_todos")}
                </button>
                {selectedIds.size > 0 && (
                  <button type="button" onClick={deleteSelected} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11, color: "oklch(0.55 0.18 15)", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                    <Trash2 size={12} />{t("cp_excluir")} ({selectedIds.size})
                  </button>
                )}
                <button type="button" onClick={exitSelection} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11, color: "#A78BFA", fontFamily: "inherit", fontWeight: 600 }}>{t("cancelar")}</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div ref={listRef} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        style={{ flex: 1, padding: "0 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: MUTED, fontSize: 13, padding: "24px 0" }}>{t("cp_carregando")}</p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 40 }}>🛒</span>
            <p style={{ fontWeight: 500, color: FOREGROUND, fontSize: 14, margin: 0 }}>{t("cp_lista_vazia")}</p>
            <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, margin: 0 }}>{t("cp_lista_vazia_sub")}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: ITEM_GAP }}>
            {items.map((item, index) => {
              const isSelected = selectedIds.has(item.id);
              const isDragging = dragFrom === index;
              const isDropTarget = dragTo !== null && dragFrom !== null && dragTo === index && dragFrom !== index;
              const parsed = parseQuantity(item.quantity, item.quantity_unit);
              const multiplier = lineMultiplier(item.quantity, item.quantity_unit);
              const itemLineTotal = (item.estimated_price ?? 0) * multiplier;

              const itemStyle: React.CSSProperties = {
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 10px 10px 6px", borderRadius: 12,
                background: isSelected ? `${PURPLE_HEX}20` : item.checked ? "transparent" : DARK_CARD,
                border: isSelected ? `1px solid ${PURPLE_HEX}` : item.checked ? "1px solid transparent" : `1px solid ${BORDER}`,
                userSelect: "none", WebkitUserSelect: "none" as never,
                transition: "box-shadow 0.15s, border-color 0.15s",
              };

              if (isDragging) {
                itemStyle.position = "relative";
                itemStyle.zIndex = 50;
                itemStyle.transform = `translateY(${dragDelta}px) scale(1.02)`;
                itemStyle.boxShadow = "0 12px 40px rgba(124,92,255,0.4), 0 4px 12px rgba(0,0,0,0.5)";
                itemStyle.borderColor = PURPLE_HEX;
                itemStyle.background = "oklch(.22 .03 270 / .97)";
                itemStyle.willChange = "transform";
              }

              const showIndicator = isDropTarget && dragFrom !== null;
              const insertBefore = showIndicator && dragTo! < dragFrom!;

              return (
                <div key={item.id}>
                  {showIndicator && insertBefore && (
                    <div style={{ height: 2, marginBottom: ITEM_GAP, borderRadius: 9999, background: PURPLE_HEX, boxShadow: "0 0 8px rgba(124,92,255,0.6)" }} />
                  )}

                  <div data-drag-row style={itemStyle}>
                    {/* Grip */}
                    {!selectionMode && (
                      <div onPointerDown={(e) => handlePointerDown(e, index)}
                        style={{ width: 22, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", color: MUTED, opacity: 0.5, touchAction: "none" }}>
                        <GripVertical size={16} />
                      </div>
                    )}

                    {/* Selection checkbox */}
                    {selectionMode && (
                      <button type="button" onClick={() => toggleSelection(item.id)}
                        style={{ width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: "pointer", padding: 0 }}>
                        {isSelected ? <CheckSquare size={20} color={PURPLE_HEX} /> : <Square size={20} color={MUTED} />}
                      </button>
                    )}

                    {/* Completed checkbox */}
                    {!selectionMode && (
                      <button type="button" onClick={() => handleToggle(item)}
                        style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: item.checked ? "none" : `1.5px solid ${BORDER}`, background: item.checked ? PURPLE_HEX : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                        {item.checked && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, cursor: selectionMode ? "default" : "pointer" }}
                      onClick={() => !selectionMode && handleToggle(item)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, color: item.checked ? MUTED : FOREGROUND, textDecoration: item.checked ? "line-through" : "none", wordBreak: "break-word" }}>
                          {item.item_name}
                        </span>
                        {parsed.num && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, background: "rgba(167,139,250,0.10)", padding: "1px 7px", borderRadius: 9999 }}>
                            {parsed.num}{parsed.unit ? ` ${unitLabel(parsed.unit)}` : ""}
                          </span>
                        )}
                        {item.priority && <Star size={13} color="#fbbf24" fill="#fbbf24" style={{ flexShrink: 0 }} />}
                      </div>
                      {item.note && (
                        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.note}
                        </p>
                      )}
                    </div>

                    {/* Price */}
                    {item.estimated_price != null && (
                      <span style={{ textAlign: "right", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#5EEAD4", display: "block" }}>
                          {fmt(itemLineTotal, currency)}
                        </span>
                        {multiplier > 1 && (
                          <span style={{ fontSize: 10, color: MUTED, display: "block" }}>
                            {multiplier} × {fmt(item.estimated_price, currency)}
                          </span>
                        )}
                      </span>
                    )}

                    {/* Edit */}
                    {!selectionMode && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                        style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: "#7C5CFF", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Pencil size={15} color="#fff" />
                      </button>
                    )}

                    {/* Delete */}
                    {!selectionMode && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: "#FF4D4D", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={15} color="#fff" />
                      </button>
                    )}
                  </div>

                  {showIndicator && !insertBefore && (
                    <div style={{ height: 2, marginTop: ITEM_GAP, borderRadius: 9999, background: PURPLE_HEX, boxShadow: "0 0 8px rgba(124,92,255,0.6)" }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — totais */}
      {!loading && items.length > 0 && (
        <div style={{ margin: "12px 20px 0", padding: "14px 16px", borderRadius: 16, background: "#1a1530", border: "1px solid rgba(167,139,250,0.15)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 12, color: MUTED }}>
              {t("cp_a_comprar")} ({uncheckedCount})
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#5EEAD4" }}>{fmt(projected, currency)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: "1px solid rgba(167,139,250,0.08)", paddingTop: 10 }}>
            <span style={{ fontSize: 12, color: MUTED }}>
              {t("cp_comprado")} ({checkedCount})
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#22D18B" }}>{fmt(purchased, currency)}</span>
          </div>
        </div>
      )}

      {/* FAB — adicionar item */}
      <div className="fixed bottom-20 right-5 z-40">
        <button
          type="button"
          onClick={focusAdd}
          aria-label={t("cp_adicionar_placeholder")}
          style={{ width: 56, height: 56, borderRadius: "50%", background: PURPLE_HEX, border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(124,92,255,0.4)" }}
        >
          <Plus size={24} color="#fff" />
        </button>
      </div>

      {/* Sheet — editar item */}
      {editing && (
        <div onClick={() => setEditing(null)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 480, background: "#151520", borderRadius: "24px 24px 0 0", padding: "20px 20px max(24px, env(safe-area-inset-bottom))", border: "1px solid rgba(167,139,250,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: FOREGROUND }}>{t("cp_editar_item")}</span>
              <button type="button" onClick={() => setEditing(null)} style={{ background: "none", border: 0, color: MUTED, fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t("cp_item")}
                style={inputStyle} />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" inputMode="decimal" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} placeholder={t("cp_quantidade")} style={{ ...inputStyle, flex: 1 }} />
                <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <input type="text" inputMode="decimal" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder={`${t("cp_preco")} (${SYMBOL[currency] ?? currency})`} style={inputStyle} />
              <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder={t("cp_nota")} style={inputStyle} />
              <button type="button" onClick={() => setEditPriority(!editPriority)}
                style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: editPriority ? "#fbbf24" : MUTED, padding: 0 }}>
                <Star size={16} fill={editPriority ? "#fbbf24" : "none"} /> {t("cp_prioritario")}
              </button>
              {editLineTotal != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexWrap: "wrap" }}>
                  <span style={{ color: MUTED }}>{t("cp_item_total")}:</span>
                  <span style={{ color: "#5EEAD4", fontWeight: 700 }}>{fmt(editLineTotal, currency)}</span>
                  {editMultiplier > 1 && (
                    <span style={{ color: MUTED }}>· {editMultiplier} × {fmt(editPriceNum!, currency)}</span>
                  )}
                </div>
              )}

              <button type="button" onClick={saveEdit} disabled={savingEdit || !editName.trim()}
                style={{ width: "100%", marginTop: 4, padding: "13px", borderRadius: 12, border: 0, background: editName.trim() ? PURPLE_HEX : "#1e1840", color: "#fff", fontSize: 14, fontWeight: 700, cursor: editName.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {savingEdit ? t("salvando") : t("salvar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet — editar lista */}
      {showMeta && (
        <div onClick={() => setShowMeta(false)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 480, background: "#151520", borderRadius: "24px 24px 0 0", padding: "20px 20px max(24px, env(safe-area-inset-bottom))", border: "1px solid rgba(167,139,250,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: FOREGROUND }}>{t("cp_editar_lista")}</span>
              <button type="button" onClick={() => setShowMeta(false)} style={{ background: "none", border: 0, color: MUTED, fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setMetaEmoji(e)}
                  style={{ width: 40, height: 40, borderRadius: 12, fontSize: 20, background: metaEmoji === e ? "rgba(124,92,255,0.2)" : "transparent", border: metaEmoji === e ? `1.5px solid ${PURPLE_HEX}` : "1px solid rgba(167,139,250,0.12)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {e}
                </button>
              ))}
            </div>

            <input type="text" value={metaName} onChange={(e) => setMetaName(e.target.value)} placeholder={t("cp_nome_lista")} style={inputStyle} />

            <button type="button" onClick={saveMeta} disabled={savingMeta || !metaName.trim()}
              style={{ width: "100%", marginTop: 12, padding: "13px", borderRadius: 12, border: 0, background: metaName.trim() ? PURPLE_HEX : "#1e1840", color: "#fff", fontSize: 14, fontWeight: 700, cursor: metaName.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
              {savingMeta ? t("salvando") : t("cp_salvar_lista")}
            </button>
            <button type="button" onClick={deleteList}
              style={{ width: "100%", marginTop: 8, padding: "13px", borderRadius: 12, border: "1px solid rgba(255,77,77,0.3)", background: "transparent", color: "#FF4D4D", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t("cp_excluir")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", minWidth: 0, boxSizing: "border-box", padding: "12px 14px", borderRadius: 12,
  border: "1px solid rgba(167,139,250,0.25)", background: "#0B0B10", color: "#e0d6ff",
  fontSize: 14, fontFamily: "inherit", outline: "none",
};
