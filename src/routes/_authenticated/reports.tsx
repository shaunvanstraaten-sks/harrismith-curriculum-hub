import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [{ title: "Reports — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

function ReportsPage() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["all-submissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("moderation_submissions")
        .select(
          "id, moderation_type, moderation_date, percentage, status, grades(name), subjects(name), teacher:profiles!moderation_submissions_teacher_id_fkey(full_name, email)",
        )
        .order("moderation_date", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("nav.reports")}</h1>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">{t("moderation.date")}</th>
              <th className="p-3">Type</th>
              <th className="p-3">{t("moderation.teacher")}</th>
              <th className="p-3">{t("moderation.grade")}</th>
              <th className="p-3">{t("moderation.subject")}</th>
              <th className="p-3">%</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3">{r.moderation_date}</td>
                <td className="p-3 capitalize">{r.moderation_type.replace("_", " ")}</td>
                <td className="p-3">{r.teacher?.full_name || r.teacher?.email || "—"}</td>
                <td className="p-3">{r.grades?.name ?? "—"}</td>
                <td className="p-3">{r.subjects?.name ?? "—"}</td>
                <td className="p-3">{Number(r.percentage).toFixed(1)}%</td>
                <td className="p-3 text-right">
                  <Link
                    to="/moderation/view/$id"
                    params={{ id: r.id }}
                    className="text-primary hover:underline"
                  >
                    {t("common.view")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
