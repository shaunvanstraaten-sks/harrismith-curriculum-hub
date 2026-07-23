import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Harrismith Primary School — Curriculum & Moderation Portal" },
      {
        name: "description",
        content:
          "Secure, bilingual curriculum management and moderation platform for Harrismith Primary School staff.",
      },
      { property: "og:title", content: "Harrismith Primary School — Curriculum & Moderation Portal" },
      {
        property: "og:description",
        content:
          "Digitises the Department of Education moderation process for Harrismith Primary School.",
      },
    ],
  }),
});

function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen brand-gradient text-white flex flex-col">
      <header className="max-w-6xl mx-auto w-full px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/hps-logo.jpg"
            alt="Harrismith Primary crest"
            className="h-11 w-11 rounded bg-white p-1"
          />
          <span className="font-semibold">{t("app.name")}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            to="/auth"
            className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold hover:brightness-110"
          >
            {t("auth.signIn")}
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-16 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-widest mb-4">
            Semper Procedo
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            {t("app.subtitle")}
          </h1>
          <p className="mt-6 text-white/80 text-lg max-w-lg">
            A secure, bilingual (English & Afrikaans) platform that digitises curriculum
            moderation, tracks coverage and empowers school leadership with real-time
            insight.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-accent text-accent-foreground px-6 py-3 font-semibold hover:brightness-110"
            >
              {t("auth.signIn")}
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-md border border-white/30 px-6 py-3 font-semibold hover:bg-white/10"
            >
              {t("auth.signUp")}
            </Link>
          </div>
        </div>
        <div className="hidden md:flex justify-center">
          <img
            src="/hps-logo.jpg"
            alt="School crest"
            className="w-80 h-80 rounded-2xl bg-white p-6 shadow-2xl"
          />
        </div>
      </main>

      <footer className="border-t border-white/10 py-4 text-center text-sm text-white/70">
        © {new Date().getFullYear()} Harrismith Primary School · {t("app.tagline")}
      </footer>
    </div>
  );
}
