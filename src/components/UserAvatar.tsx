"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslation } from "@/lib/useTranslation";

function loadCache() {
  try {
    const raw = localStorage.getItem("user_profile");
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return null;
}

function saveCache(data: { name?: string; avatar_url?: string }) {
  try {
    localStorage.setItem("user_profile", JSON.stringify(data));
  } catch { /* noop */ }
}

export function UserAvatar() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<{ name: string; avatar_url: string }>({ name: "", avatar_url: "" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cache = loadCache();
    if (cache) {
      setProfile(cache);
      setReady(true);
    }

    let cancelled = false;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const next = { name: data.name || "", avatar_url: data.avatar_url || "" };
        setProfile(next);
        saveCache(next);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  const fallbackContent = ready
    ? profile.name
      ? profile.name.charAt(0).toUpperCase()
      : "EU"
    : null;

  return (
    <Avatar className="h-8 w-8 cursor-pointer">
      {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={t("foto")} />}
      <AvatarFallback
        className="bg-primary text-primary-foreground text-xs"
        {...(ready ? {} : { "data-loading": true })}
      >
        {fallbackContent ?? (
          <span className="inline-block size-2.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
        )}
      </AvatarFallback>
    </Avatar>
  );
}
