import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth, hasAnyRole } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, ClipboardCheck, BookOpen, TrendingUp, Users, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Harrismith Primary Portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function DashboardPage() {
  const { t } = useTranslation();
  const { user, roles, fullName } = useAuth();

  const { data: submissions } = useQuery({
    queryKey: ["dashboard-submissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_submissions")
        .select("id, moderation_type, percentage, status, moderation_date, teacher_id")
        .order("moderation_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const isStaff = hasAnyRole(roles, ["administrator", "principal", "hod", "head_of_subject"]);
  const submitted = (submissions ?? []).filter((s) => s.status === "submitted");
  const avg =
    submitted.length > 0
      ? submitted.reduce((a, b) => a + Number(b.percentage), 0) / submitted.length
      : 0;
  const below85 = submitted.filter((s) => Number(s.percentage) < 85).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-muted-foreground">{t("dashboard.welcome")}</div>
        <h1 className="text-3xl font-bold">{fullName || user?.email}</h1>
      </div>

      {/* KPI cards for staff */}
      {isStaff && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<ClipboardList size={20} />} label={t("dashboard.latest")} value={String(submitted.length)} />
          <KpiCard icon={<TrendingUp size={20} />} label={t("dashboard.avgScore")} value={`${avg.toFixed(1)}%`} />
          <KpiCard icon={<AlertCircle size={20} />} label="Below 85%" value={String(below85)} />
          <KpiCard icon={<Users size={20} />} label={t("dashboard.teachers")} value="—" />
        </section>
      )}

      {/* Moderation cards */}
      <section>
        <h2 className="text-xl font-semibold mb-4">{t("dashboard.curriculumModeration")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <ModerationCard
            to="/moderation/pre/new"
            title={t("dashboard.preModeration")}
            desc={t("dashboard.preModerationDesc")}
            icon={<ClipboardList size={28} />}
            color="bg-brand-navy text-white"
          />
          <ModerationCard
            to="/moderation/post/new"
            title={t("dashboard.postModeration")}
            desc={t("dashboard.postModerationDesc")}
            icon={<ClipboardCheck size={28} />}
            color="bg-brand-green text-white"
          />
          <ModerationCard
            to="/moderation/book/new"
            title={t("dashboard.bookControl")}
            desc={t("dashboard.bookControlDesc")}
            icon={<BookOpen size={28} />}
            color="bg-brand-orange text-white"
          />
        </div>
      </section>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between text-muted-foreground text-sm">
        <span>{label}</span>
        <span className="text-brand-orange">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function ModerationCard({
  to,
  title,
  desc,
  icon,
  color,
}: {
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Link
      to={to}
      className="card-elevated overflow-hidden group hover:shadow-lg transition-shadow"
    >
      <div className={`${color} p-6 flex items-center gap-4`}>
        <div className="rounded-full bg-white/15 p-3">{icon}</div>
        <div className="text-xl font-semibold">{title}</div>
      </div>
      <div className="p-5 text-sm text-muted-foreground">{desc}</div>
    </Link>
  );
}
