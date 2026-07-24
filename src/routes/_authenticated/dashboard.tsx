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
  const isStaff = hasAnyRole(roles, ["administrator", "principal", "hod", "head_of_subject"]);

  const { data: submissions } = useQuery({
    queryKey: ["dashboard-submissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_submissions")
        .select("id, moderation_type, percentage, status, moderation_date, teacher_id")
        .order("moderation_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Moderations completed *about me* as the teacher. When a Head of Subject
  // submits e.g. a Book Control for this teacher, it lands here.
  const { data: myCompleted } = useQuery({
    queryKey: ["my-completed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_submissions")
        .select(
          "id, moderation_type, moderation_date, quarter, percentage, max_score, grades(name), subjects(name)",
        )
        .eq("teacher_id", user!.id)
        .eq("status", "submitted")
        .order("moderation_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submitted = (submissions ?? []).filter((s) => s.status === "submitted");
  const countOf = (type: string) => submitted.filter((s) => s.moderation_type === type).length;

  // Teachers the viewer can actually see, derived from scoped records rather
  // than a school-wide profiles count.
  const teacherCount = new Set(submitted.map((s) => s.teacher_id)).size;

  // Pre-Moderation is a checklist with no meaningful percentage, so it must not
  // drag the averages around. Only scored types count towards these figures.
  const scored = submitted.filter((s) => s.moderation_type !== "pre_moderation");
  const avg = scored.length > 0 ? scored.reduce((a, b) => a + Number(b.percentage), 0) / scored.length : 0;
  const below85 = scored.filter((s) => Number(s.percentage) < 85).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-muted-foreground">{t("dashboard.welcome")}</div>
        <h1 className="text-3xl font-bold">{fullName || user?.email}</h1>
      </div>

      {/* KPI cards for staff — every card drills through to the matching History view */}
      {isStaff && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            icon={<ClipboardList size={20} />}
            label={t("dashboard.preModeration")}
            value={String(countOf("pre_moderation"))}
            to="/history"
            search={{ type: "pre_moderation", status: "submitted" }}
          />
          <KpiCard
            icon={<ClipboardCheck size={20} />}
            label={t("dashboard.postModeration")}
            value={String(countOf("post_moderation"))}
            to="/history"
            search={{ type: "post_moderation", status: "submitted" }}
          />
          <KpiCard
            icon={<BookOpen size={20} />}
            label={t("dashboard.bookControl")}
            value={String(countOf("book_control"))}
            to="/history"
            search={{ type: "book_control", status: "submitted" }}
          />
          <KpiCard
            icon={<TrendingUp size={20} />}
            label={t("dashboard.avgScore")}
            value={scored.length ? `${avg.toFixed(1)}%` : "—"}
            hint={t("dashboard.scoredOnly")}
            to="/history"
            search={{ status: "submitted" }}
          />
          <KpiCard
            icon={<AlertCircle size={20} />}
            label={t("dashboard.below85")}
            value={String(below85)}
            hint={t("dashboard.scoredOnly")}
            to="/history"
            search={{ status: "submitted" }}
          />
          <KpiCard
            icon={<Users size={20} />}
            label={t("dashboard.teachers")}
            value={String(teacherCount)}
            hint={t("dashboard.teachersHint")}
            to="/teachers"
          />
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

      {/* Moderations completed about me, by type */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("dashboard.myCompleted")}</h2>
        {(["pre_moderation", "post_moderation", "book_control"] as const).map((type) => {
          const items = (myCompleted ?? []).filter((r: any) => r.moderation_type === type);
          return (
            <div key={type} className="card-elevated overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-sm font-semibold text-primary">
                {t(completedLabelKey(type))}
                <span className="ml-2 font-normal text-muted-foreground">({items.length})</span>
              </div>
              {items.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">{t("dashboard.noneYet")}</div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((r: any) => {
                      const showPct = type !== "pre_moderation" && Number(r.max_score) > 0;
                      const pct = Number(r.percentage);
                      const color = pct >= 85 ? "bg-status-green" : pct >= 70 ? "bg-status-orange" : "bg-status-red";
                      return (
                        <tr key={r.id} className="border-t border-border">
                          <td className="p-3 whitespace-nowrap">{r.moderation_date}</td>
                          <td className="p-3">{r.subjects?.name ?? "—"}</td>
                          <td className="p-3">{r.grades?.name ?? "—"}</td>
                          <td className="p-3">
                            {t("moderation.term")} {r.quarter}
                          </td>
                          <td className="p-3">
                            {showPct ? (
                              <span className={`inline-block rounded px-2 py-0.5 text-white text-xs ${color}`}>{pct.toFixed(1)}%</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <Link to="/moderation/view/$id" params={{ id: r.id }} className="text-primary hover:underline font-medium">
                              {t("common.view")}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function completedLabelKey(type: string) {
  if (type === "book_control") return "dashboard.completedBook";
  if (type === "post_moderation") return "dashboard.completedPost";
  return "dashboard.completedPre";
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  to,
  search,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  to?: string;
  search?: Record<string, string>;
}) {
  const body = <KpiBody icon={icon} label={label} value={value} hint={hint} />;
  if (!to) return body;
  return (
    <Link to={to} search={search} className="block transition hover:shadow-lg hover:-translate-y-0.5">
      {body}
    </Link>
  );
}

function KpiBody({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between text-muted-foreground text-sm">
        <span>{label}</span>
        <span className="text-brand-orange">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
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
