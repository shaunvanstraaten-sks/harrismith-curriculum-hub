import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/teachers")({
  component: TeachersPage,
  head: () => ({
    meta: [{ title: "Teachers — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

type Row = {
  id: string;
  name: string;
  pre: number;
  post: number;
  book: number;
  scoredTotal: number;
  scoredCount: number;
  last: string | null;
};

function TeachersPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const isStaff = hasAnyRole(roles, ["administrator", "principal", "hod", "head_of_subject"]);

  // Built from moderation_submissions, so RLS scopes it exactly like everything
  // else: a Grade 4 HOD only sees Grade 4 records, and therefore only the
  // teachers and scores within that scope.
  const { data, isLoading } = useQuery({
    queryKey: ["teacher-overview"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_submissions")
        .select(
          "moderation_type, percentage, max_score, moderation_date, teacher_id, teacher:profiles!moderation_submissions_teacher_id_fkey(full_name, email)",
        )
        .eq("status", "submitted")
        .order("moderation_date", { ascending: false });
      if (error) throw error;

      const by = new Map<string, Row>();
      (data ?? []).forEach((r: any) => {
        const id = r.teacher_id as string;
        const row =
          by.get(id) ??
          ({
            id,
            name: r.teacher?.full_name || r.teacher?.email || "—",
            pre: 0,
            post: 0,
            book: 0,
            scoredTotal: 0,
            scoredCount: 0,
            last: null,
          } as Row);

        if (r.moderation_type === "pre_moderation") row.pre += 1;
        else if (r.moderation_type === "post_moderation") row.post += 1;
        else if (r.moderation_type === "book_control") row.book += 1;

        // Pre-Moderation is a checklist with no meaningful percentage.
        if (r.moderation_type !== "pre_moderation" && Number(r.max_score) > 0) {
          row.scoredTotal += Number(r.percentage);
          row.scoredCount += 1;
        }
        if (!row.last || r.moderation_date > row.last) row.last = r.moderation_date;

        by.set(id, row);
      });
      return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  if (!isStaff) return <div className="text-muted-foreground">Access denied.</div>;

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-muted-foreground">{t("nav.dashboard")}</div>
        <h1 className="text-3xl font-bold">{t("teachers.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("teachers.intro")}</p>
      </div>

      <div className="card-elevated overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">{t("teachers.empty")}</div>
        ) : (
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">{t("moderation.teacher")}</th>
                <th className="p-3">{t("dashboard.preModeration")}</th>
                <th className="p-3">{t("dashboard.postModeration")}</th>
                <th className="p-3">{t("dashboard.bookControl")}</th>
                <th className="p-3">{t("dashboard.avgScore")}</th>
                <th className="p-3">{t("teachers.last")}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const avg = r.scoredCount ? r.scoredTotal / r.scoredCount : null;
                const color =
                  avg === null
                    ? ""
                    : avg >= 85
                      ? "bg-status-green"
                      : avg >= 70
                        ? "bg-status-orange"
                        : "bg-status-red";
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">{r.pre}</td>
                    <td className="p-3">{r.post}</td>
                    <td className="p-3">{r.book}</td>
                    <td className="p-3">
                      {avg === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={`inline-block rounded px-2 py-0.5 text-white text-xs ${color}`}>
                          {avg.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">{r.last ?? "—"}</td>
                    <td className="p-3 text-right">
                      <Link
                        to="/history"
                        search={{ teacher_id: r.id, status: "submitted" }}
                        className="text-primary hover:underline font-medium"
                      >
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
    </div>
  );
}
