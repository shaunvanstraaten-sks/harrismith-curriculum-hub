import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Reset password — Harrismith Primary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ResetPassword() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("auth.passwordUpdated"));
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen brand-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md card-elevated p-8">
        <h1 className="text-2xl font-bold">{t("auth.resetPassword")}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">{t("auth.newPassword")}</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            disabled={busy}
            className="w-full rounded-md bg-primary text-primary-foreground font-semibold py-2.5 disabled:opacity-60"
          >
            {t("auth.updatePassword")}
          </button>
        </form>
      </div>
    </div>
  );
}
