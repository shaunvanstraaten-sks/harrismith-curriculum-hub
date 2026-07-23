import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ClipboardList, ClipboardCheck, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/moderation/")({
  component: ModerationHome,
  head: () => ({
    meta: [{ title: "Moderation — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

function ModerationHome() {
  const { t } = useTranslation();
  const cards = [
    { to: "/moderation/pre", title: t("dashboard.preModeration"), desc: t("dashboard.preModerationDesc"), icon: <ClipboardList size={28} />, color: "bg-brand-navy text-white" },
    { to: "/moderation/post", title: t("dashboard.postModeration"), desc: t("dashboard.postModerationDesc"), icon: <ClipboardCheck size={28} />, color: "bg-brand-green text-white" },
    { to: "/moderation/book", title: t("dashboard.bookControl"), desc: t("dashboard.bookControlDesc"), icon: <BookOpen size={28} />, color: "bg-brand-orange text-white" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.curriculumModeration")}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="card-elevated overflow-hidden hover:shadow-lg">
            <div className={`${c.color} p-6 flex items-center gap-4`}>
              <div className="rounded-full bg-white/15 p-3">{c.icon}</div>
              <div className="text-xl font-semibold">{c.title}</div>
            </div>
            <div className="p-5 text-sm text-muted-foreground">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
