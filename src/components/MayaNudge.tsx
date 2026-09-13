"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, X } from "lucide-react";
import { MayaAvatar } from "@/components/MayaAvatar";
import { useTranslation } from "@/lib/useTranslation";

interface Nudge {
  id: string;
  message: string;
}

function nudgeLink(id: string): string | null {
  if (id.startsWith("checkin")) return "/check-in";
  if (id.startsWith("breakfast") || id.startsWith("lunch") || id.startsWith("dinner") || id.startsWith("meals")) return "/nutricao/registrar";
  if (id.startsWith("diary")) return "/diario/novo";
  return null;
}

const ROTATE_INTERVAL = 3 * 60 * 1000; // 3 minutos

export function MayaNudge() {
  const router = useRouter();
  const { t } = useTranslation();
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/maya/nudge")
      .then((r) => r.json())
      .then((data) => {
        if (data.nudges?.length > 0) setNudges(data.nudges);
      })
      .catch(() => {});
  }, []);

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1 < nudges.length ? prev + 1 : prev));
  }, [nudges.length]);

  const dismiss = () => advance();

  // Auto-rotate
  useEffect(() => {
    if (nudges.length <= 1) return;
    const t = setInterval(advance, ROTATE_INTERVAL);
    return () => clearInterval(t);
  }, [nudges.length, advance]);

  if (nudges.length === 0 || index >= nudges.length) return null;

  const nudge = nudges[index];
  const link = nudgeLink(nudge.id);

  return (
    <Card
      className={`rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent hover:from-primary/10 transition-all duration-500 group relative ${link ? "cursor-pointer" : ""}`}
      onClick={link ? () => router.push(link) : undefined}
    >
      <CardContent className="p-3 pr-9">
        <div className="flex items-start gap-2.5">
          <MayaAvatar state="mini" size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary/70 mb-0.5">Maya</p>
            <p className="text-sm leading-relaxed text-foreground/85">{nudge.message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          className="absolute top-2.5 right-2.5 size-6 rounded-full hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground/50 hover:text-muted-foreground"
          aria-label={t("fechar")}
        >
          <X className="size-3" />
        </button>
        {link && (
          <span className="absolute bottom-2.5 right-3 text-muted-foreground/30 group-hover:text-primary/50 transition-colors">
            <ArrowUpRight className="size-3.5" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
