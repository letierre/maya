"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success(t("ate_logo"));
    router.push("/");
    router.refresh();
  };

  return (
    <button onClick={handleLogout} className="w-full text-left px-2 py-1.5 text-sm">
      {t("sair")}
    </button>
  );
}
