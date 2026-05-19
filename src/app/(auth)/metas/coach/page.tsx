"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Send, Sparkles } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; id: string }

const STARTER_PROMPTS = [
  "Como estão minhas metas?",
  "O que devo priorizar esta semana?",
  "Estou travado em uma meta, me ajuda?",
  "Faz um resumo do meu progresso",
];

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "oklch(.65 .06 160)",
          animation: `bounce .9s ${i * 0.15}s ease-in-out infinite`,
        }} />
      ))}
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}

export default function GoalsCoachPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: "user", content: trimmed, id: Date.now().toString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/goals/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.reply || "Desculpa, não consegui responder agora.";
      const parts = reply.split(/\n\n+/).filter(Boolean);

      for (let i = 0; i < parts.length; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 800 : 400));
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: parts[i],
          id: `${Date.now()}-${i}`,
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Erro de conexão. Tente novamente.",
        id: Date.now().toString(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`;
  };

  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      background: "oklch(.97 .006 160)",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, oklch(.42 .14 200), oklch(.5 .12 160))",
        padding: "48px 16px 16px",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <button type="button" onClick={() => router.back()} style={{
          border: 0, background: "oklch(1 0 0 / .15)", borderRadius: 10,
          padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center",
        }}>
          <ChevronLeft size={20} color="#fff" />
        </button>
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          background: "oklch(1 0 0 / .2)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Sparkles size={22} color="#fff" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>Maya Coach</p>
          <p style={{ margin: 0, fontSize: 11, color: "oklch(1 0 0 / .75)" }}>
            {loading ? "Digitando…" : "Sua coach de metas IA"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 16px",
              background: "linear-gradient(135deg, oklch(.42 .14 200), oklch(.5 .12 160))",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={30} color="#fff" />
            </div>
            <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "oklch(.25 .04 160)" }}>
              Olá! Sou sua Maya Coach
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "oklch(.5 .04 160)", lineHeight: 1.6 }}>
              Tenho acesso completo às suas metas e planejamento. O que quer trabalhar hoje?
            </p>
            {/* Starter prompts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STARTER_PROMPTS.map((p) => (
                <button key={p} type="button" onClick={() => send(p)} style={{
                  padding: "12px 16px", borderRadius: 14, border: "1.5px solid oklch(.85 .04 160)",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 500, color: "oklch(.35 .06 160)",
                  textAlign: "left", transition: "all .15s ease",
                }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} style={{
              display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}>
              {!isUser && (
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, oklch(.42 .14 200), oklch(.5 .12 160))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginRight: 8, alignSelf: "flex-end",
                }}>
                  <Sparkles size={14} color="#fff" />
                </div>
              )}
              <div style={{
                maxWidth: "78%", padding: "11px 14px", borderRadius: isUser
                  ? "18px 18px 4px 18px"
                  : "18px 18px 18px 4px",
                background: isUser
                  ? "oklch(.5 .12 160)"
                  : "#fff",
                boxShadow: isUser
                  ? "0 2px 8px oklch(.5 .12 160 / .25)"
                  : "0 2px 8px oklch(.2 .04 160 / .08)",
                fontSize: 14, lineHeight: 1.55,
                color: isUser ? "#fff" : "oklch(.2 .02 160)",
                whiteSpace: "pre-wrap",
              }}>
                {msg.content}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, oklch(.42 .14 200), oklch(.5 .12 160))",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginRight: 8, alignSelf: "flex-end",
            }}>
              <Sparkles size={14} color="#fff" />
            </div>
            <div style={{
              padding: "11px 16px", borderRadius: "18px 18px 18px 4px",
              background: "#fff", boxShadow: "0 2px 8px oklch(.2 .04 160 / .08)",
            }}>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 16px calc(env(safe-area-inset-bottom) + 12px)",
        background: "#fff", borderTop: "1px solid oklch(.9 .02 160 / .6)",
        display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0,
      }}>
        <div style={{ flex: 1, borderRadius: 22, border: "1.5px solid oklch(.85 .03 160)", background: "oklch(.97 .005 160)", overflow: "hidden" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustHeight(); }}
            onKeyDown={handleKey}
            placeholder="Mensagem para Maya Coach..."
            rows={1}
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              padding: "12px 16px", border: "none", background: "transparent",
              fontFamily: "inherit", fontSize: 14, color: "oklch(.2 .02 160)",
              outline: "none", resize: "none", lineHeight: 1.5, maxHeight: 100,
            }}
          />
        </div>
        <button type="button" onClick={() => send(input)} disabled={!input.trim() || loading} style={{
          width: 44, height: 44, borderRadius: "50%", border: 0, flexShrink: 0,
          cursor: (!input.trim() || loading) ? "not-allowed" : "pointer",
          background: (!input.trim() || loading)
            ? "oklch(.88 .02 160)"
            : "linear-gradient(135deg, oklch(.42 .14 200), oklch(.5 .12 160))",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: (!input.trim() || loading) ? "none" : "0 4px 12px oklch(.42 .14 200 / .35)",
          transition: "all .15s ease",
        }}>
          <Send size={18} color={(!input.trim() || loading) ? "oklch(.65 .02 160)" : "#fff"} />
        </button>
      </div>
    </div>
  );
}
