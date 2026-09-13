"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { photoUrl } from "@/lib/photo-storage";
import { Heart } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";

interface Porque {
  id: string;
  text: string;
  photoPath: string | null;
}

const ROTATE_INTERVAL = 30 * 60 * 1000; // 30 minutos

const COLOR_SCHEMES = {
  feminino: {
    border: "border-pink-200 dark:border-pink-900",
    bg: "bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20",
    icon: "text-pink-400",
    label: "text-pink-500 dark:text-pink-400",
  },
  masculino: {
    border: "border-blue-200 dark:border-blue-900",
    bg: "bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/20 dark:to-sky-950/20",
    icon: "text-blue-400",
    label: "text-blue-500 dark:text-blue-400",
  },
  nao_dizer: {
    border: "border-emerald-200 dark:border-emerald-900",
    bg: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20",
    icon: "text-emerald-400",
    label: "text-emerald-500 dark:text-emerald-400",
  },
} as const;

export function PorqueCard({ gender = "nao_dizer" }: { gender?: string }) {
  const { t } = useTranslation();
  const [porques, setPorques] = useState<Porque[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.porques?.length > 0) {
          setPorques(data.porques);
          setIndex(Math.floor(Math.random() * data.porques.length));
        }
      })
      .catch(() => {});
  }, []);

  const advance = useCallback(() => {
    if (porques.length <= 1) return;
    setIndex((prev) => {
      let next;
      do {
        next = Math.floor(Math.random() * porques.length);
      } while (next === prev && porques.length > 1);
      return next;
    });
  }, [porques.length]);

  // Auto-rotate
  useEffect(() => {
    if (porques.length <= 1) return;
    const t = setInterval(advance, ROTATE_INTERVAL);
    return () => clearInterval(t);
  }, [porques.length, advance]);

  if (porques.length === 0) return null;

  const pq = porques[index];
  const src = pq.photoPath ? photoUrl(pq.photoPath) : null;
  const colors = COLOR_SCHEMES[gender as keyof typeof COLOR_SCHEMES] || COLOR_SCHEMES.nao_dizer;

  return (
    <Card className={`rounded-2xl ${colors.border} ${colors.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Heart className={`size-5 ${colors.icon} shrink-0 mt-0.5`} fill="currentColor" />
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <p className={`text-xs font-medium ${colors.label} mb-1`}>
                {t("pq_meu_porque")}
              </p>
              <p className="text-sm leading-relaxed text-foreground/85 italic">
                {pq.text || "—"}
              </p>
            </div>
            {src && (
              <img
                src={src}
                alt=""
                className="w-full aspect-[3/2] object-cover rounded-xl"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
