import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { GraduationCap, School } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resources/")({
  component: ResourcesHome,
  head: () => ({
    meta: [{ title: "Resources — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

function ResourcesHome() {
  const { t } = useTranslation();
  const cards = [
    {
      to: "/resources/intermediate",
      title: t("resources.intermediatePhase"),
      desc: t("resources.intermediatePhaseDesc"),
      icon: <GraduationCap size={28} />,
      color: "bg-brand-navy text-white",
    },
    {
      to: "/resources/senior",
      title: t("resources.seniorPhase"),
      desc: t("resources.seniorPhaseDesc"),
      icon: <School size={28} />,
      color: "bg-brand-green text-white",
    },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("resources.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("resources.intro")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="card-elevated overflow-hidden hover:shadow-lg transition-shadow">
            <div className={`${c.color} p-6 flex items-center gap-4`}>
              <div className="rounded-full bg-white/15 p-3 shrink-0">{c.icon}</div>
              <div className="text-xl font-semibold min-w-0 break-words">{c.title}</div>
            </div>
            <div className="p-5 text-sm text-muted-foreground">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
