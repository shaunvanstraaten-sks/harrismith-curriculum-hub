import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import "@/lib/i18n";

const searchSchema = z.object({ mode: z.enum(["signin", "signup", "forgot"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Harrismith Primary Portal" },
      {
        name: "description",
        content: "Sign in or register for the Harrismith Primary Curriculum & Moderation Portal.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AuthPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, username },
          },
        });
        if (error) throw error;
        toast.success(t("auth.checkEmail"));
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("auth.resetEmailSent"));
        setMode("signin");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen brand-gradient flex flex-col">
      <header className="max-w-5xl mx-auto w-full px-6 py-5 flex items-center justify-between text-white">
        <Link to="/" className="flex items-center gap-3">
          <img src="/hps-logo.jpg" alt="crest" className="h-10 w-10 rounded bg-white p-1" />
          <span className="font-semibold">{t("app.name")}</span>
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md card-elevated p-8">
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "signin"
              ? t("auth.signInTitle")
              : mode === "signup"
                ? t("auth.signUpTitle")
                : t("auth.resetPassword")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.subtitle")}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <Field
                  label={t("auth.fullName")}
                  value={fullName}
                  onChange={setFullName}
                  required
                />
                <Field
                  label={t("auth.username")}
                  value={username}
                  onChange={setUsername}
                  required
                />
              </>
            )}
            <Field
              label={t("auth.email")}
              type="email"
              value={email}
              onChange={setEmail}
              required
            />
            {mode !== "forgot" && (
              <Field
                label={t("auth.password")}
                type="password"
                value={password}
                onChange={setPassword}
                required
              />
            )}

            <button
              disabled={busy}
              type="submit"
              className="w-full rounded-md bg-primary text-primary-foreground font-semibold py-2.5 hover:brightness-110 disabled:opacity-60"
            >
              {mode === "signin"
                ? t("auth.signInCta")
                : mode === "signup"
                  ? t("auth.signUpCta")
                  : t("auth.sendReset")}
            </button>
          </form>

          <div className="mt-5 flex flex-col gap-2 text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                <button
                  className="text-primary hover:underline text-left"
                  onClick={() => setMode("forgot")}
                >
                  {t("auth.forgotPassword")}
                </button>
                <div>
                  {t("auth.noAccount")}{" "}
                  <button
                    className="text-primary hover:underline font-medium"
                    onClick={() => setMode("signup")}
                  >
                    {t("auth.signUp")}
                  </button>
                </div>
              </>
            ) : (
              <div>
                {t("auth.haveAccount")}{" "}
                <button
                  className="text-primary hover:underline font-medium"
                  onClick={() => setMode("signin")}
                >
                  {t("auth.signIn")}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
