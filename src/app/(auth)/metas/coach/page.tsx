"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Msg { role: "user" | "assistant"; content: string; id: string }

const STARTER_PROMPTS = [
  "Como estão minhas metas?",
  "O que devo priorizar esta semana?",
  "Estou travada em uma meta",
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
      fontFamily: "var(--font-sans)",
      background: `
        radial-gradient(ellipse 70% 40% at 50% 0%, oklch(.96 .03 70 / .45) 0%, transparent 60%),
        linear-gradient(180deg, oklch(.99 .005 80) 0%, oklch(.96 .015 80) 100%)
      `,
    }}>
      {/* Header — cream with Maya avatar */}
      <div style={{
        padding: "52px 20px 14px",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        borderBottom: "1px solid oklch(.55 .08 80 / .15)",
        background: "oklch(.99 .005 80 / .7)", backdropFilter: "blur(8px)",
      }}>
        <button type="button" onClick={() => router.back()} style={{
          width: 34, height: 34, borderRadius: 9999, border: 0, cursor: "pointer",
          background: "oklch(1 0 0 / .7)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>

        {/* Maya avatar with glow ring */}
        <div style={{ position: "relative", flex: "none" }}>
          <span style={{ position: "absolute", inset: -3, borderRadius: 9999, background: "oklch(.78 .14 160 / .12)", display: "block" }} />
          <span style={{
            width: 38, height: 38, borderRadius: 9999, overflow: "hidden",
            border: "2px solid #fff", position: "relative", display: "block",
          }}>
            <img src="/maya.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </span>
          <span style={{
            position: "absolute", bottom: 0, right: 0,
            width: 10, height: 10, borderRadius: 9999, background: "#22c55e",
            border: "2px solid #fff",
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "oklch(.18 .02 160)", letterSpacing: "-0.005em" }}>
            Maya
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "oklch(.55 .03 160)", fontStyle: "italic" }}>
            {loading ? "digitando…" : "sua coach de metas · presente"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 22px 12px" }}>

        {/* Empty state — editorial */}
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0 28px" }}>
            <p style={{
              margin: "0 0 4px", fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10,
              color: "oklch(.55 .03 160)", letterSpacing: ".16em", textTransform: "uppercase",
            }}>
              Uma conversa
            </p>
            <h2 style={{
              margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em",
              fontStyle: "italic", color: "oklch(.18 .02 160)",
            }}>
              Como posso ajudar?
            </h2>
            <p style={{ margin: "8px 32px 0", fontSize: 12.5, color: "oklch(.55 .03 160)", lineHeight: 1.5 }}>
              Eu vejo suas metas, seu diário e seus check-ins. Pode me perguntar qualquer coisa.
            </p>

            <div style={{ display: "flex", justifyContent: "center", margin: "22px 0" }}>
              <span style={{ width: 44, height: 1, background: "oklch(.55 .08 80 / .35)", display: "block" }} />
            </div>

            {/* Starters as editorial menu */}
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "oklch(.55 .03 160)", textAlign: "center" }}>
                Talvez você queira começar com
              </p>
              {STARTER_PROMPTS.map((p, i) => (
                <button key={i} type="button" onClick={() => send(p)} style={{
                  width: "100%", padding: "14px 4px", cursor: "pointer", fontFamily: "inherit",
                  background: "transparent", textAlign: "left",
                  borderTop: "1px solid oklch(.55 .08 80 / .2)",
                  borderLeft: 0, borderRight: 0,
                  borderBottom: i === STARTER_PROMPTS.length - 1 ? "1px solid oklch(.55 .08 80 / .2)" : 0,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  color: "oklch(.2 .02 160)", fontSize: 14, fontWeight: 500, fontStyle: "italic",
                }}>
                  "{p}"
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ color: "oklch(.6 .03 160)", flexShrink: 0 }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} style={{
              display: isUser ? "flex" : "grid",
              gridTemplateColumns: isUser ? undefined : "32px 1fr",
              justifyContent: isUser ? "flex-end" : undefined,
              gap: isUser ? undefined : 10,
              marginBottom: 14,
              alignItems: "flex-start",
            }}>
              {!isUser && (
                <span style={{
                  width: 26, height: 26, borderRadius: 9999, overflow: "hidden",
                  border: "1px solid #fff", display: "block", flexShrink: 0, marginTop: 2,
                }}>
                  <img src="/maya.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </span>
              )}
              {isUser ? (
                <div style={{
                  maxWidth: "80%", padding: "10px 14px",
                  background: "oklch(.45 .14 160)", color: "#fff",
                  borderRadius: "16px 16px 4px 16px",
                  fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </div>
              ) : (
                <p style={{
                  margin: 0, fontSize: 14, lineHeight: 1.55, color: "oklch(.18 .02 160)",
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </p>
              )}
            </div>
          );
        })}

        {/* Typing */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 26, height: 26, borderRadius: 9999, overflow: "hidden", border: "1px solid #fff", display: "block" }}>
              <img src="/maya.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </span>
            <div style={{ paddingTop: 4 }}>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 16px calc(env(safe-area-inset-bottom) + 12px)",
        background: "oklch(.99 .005 80 / .85)", backdropFilter: "blur(8px)",
        borderTop: "1px solid oklch(.55 .08 80 / .2)",
        display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0,
      }}>
        <div style={{
          flex: 1, borderRadius: 22, border: "1px solid oklch(.55 .08 80 / .25)",
          background: "#fff", overflow: "hidden",
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustHeight(); }}
            onKeyDown={handleKey}
            placeholder="Escreva para Maya…"
            rows={1}
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              padding: "10px 16px", border: "none", background: "transparent",
              fontFamily: "inherit", fontSize: 14, color: "oklch(.2 .02 160)",
              outline: "none", resize: "none", lineHeight: 1.5, maxHeight: 100,
            }}
          />
        </div>
        <button type="button" onClick={() => send(input)} disabled={!input.trim() || loading} style={{
          width: 44, height: 44, borderRadius: 9999, border: 0, flexShrink: 0,
          background: "oklch(.45 .14 160)", cursor: (!input.trim() || loading) ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px -4px oklch(.45 .14 160 / .45)",
          opacity: (!input.trim() || loading) ? 0.45 : 1,
          transition: "opacity .15s ease",
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
