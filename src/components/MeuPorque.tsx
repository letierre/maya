"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { photoUrl } from "@/lib/photo-storage";
import { useTranslation } from "@/lib/useTranslation";

export interface Porque {
  id: string;
  text: string;
  photoPath: string | null;
}

const ROTATE_MS = 8000;

/**
 * "Meu Porquê" — âncora emocional na home: foto + frase pessoal. Onde o
 * usuário vê e relembra o porquê (hoje só existe botão de editar no perfil).
 * Rotaciona entre os porquês cadastrados quando há mais de um.
 * Dados vêm da página (via props) — sem fetch próprio, para a home renderizar tudo junto.
 */
export function MeuPorque({ porques }: { porques: Porque[] }) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (porques.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % porques.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [porques.length]);

  if (porques.length === 0) return null;

  const pq = porques[idx] ?? porques[0];
  const src = pq.photoPath ? photoUrl(pq.photoPath) : null;

  return (
    <div className="px-3.5 pt-4">
      <div className="flex items-baseline justify-between mb-2.5">
        <p
          className="m-0 text-[10px] font-bold tracking-[.12em] uppercase"
          style={{ color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}
        >
          {t("pq_meu_porque")}
        </p>
        {porques.length > 1 && (
          <div className="flex gap-1">
            {porques.map((_, i) => (
              <span
                key={i}
                className="h-[5px] rounded-full transition-[width] duration-300"
                style={{
                  width: i === idx ? 14 : 5,
                  background: i === idx ? "#A78BFA" : "oklch(.28 .02 270)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3.5">
        {src ? (
          <img
            src={src}
            alt=""
            className="w-[56px] h-[56px] rounded-2xl object-cover shrink-0"
            style={{ border: "1px solid rgba(167,139,250,0.22)" }}
          />
        ) : (
          <div
            className="w-[56px] h-[56px] rounded-2xl shrink-0 flex items-center justify-center"
            style={{ background: "rgba(167,139,250,.12)", border: "1px solid rgba(167,139,250,.18)" }}
          >
            <Heart size={22} style={{ color: "#A78BFA" }} fill="currentColor" />
          </div>
        )}
        <p className="m-0 text-[15px] leading-[1.45] italic font-medium" style={{ color: "#e0d6ff" }}>
          “{pq.text}”
        </p>
      </div>
    </div>
  );
}
