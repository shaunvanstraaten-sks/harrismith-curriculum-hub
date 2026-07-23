import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";
import { Plus } from "lucide-react";

type ModType = Database["public"]["Enums"]["moderation_type"];

const TYPE_MAP: Record<string, { db: ModType; labelKey: string }> = {
  pre: { db: "pre_moderation", labelKey: "dashboard.preModeration" },
  post: { db: "post_moderation", labelKey: "dashboard.postModeration" },
  book: { db: "book_control", labelKey: "dashboard.bookControl" },
};

export const Route = createFileRoute("/_authenticated/moderation/$type/")({
  component: TypeList,
  head: () => ({
    meta: [{ title: "Moderations — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

function TypeList() {
  const { t } = useTranslation();
  const { type } = useParams({ from: "/_authenticated/moderation/$type" });
  const cfg = TYPE_MAP[type];
  const { roles } = useAuth();
  const canCreate = hasAnyRole(roles, ["administrator", "head_of_subject"]);

  const { data, isLoading } = useQuery({
    queryKey: ["submissions", type],
    enabled: !!cfg,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_submissions")
        .select(
          "id, academic_year, quarter, cycle, weeks, moderation_date, percentage, status, total_score, max_score, grades(name), subjects(name), teacher:profiles!moderation_submissions_teacher_id_fkey(full_name, email)",
        )
        .eq("moderation_type", cfg.db)
        .order("moderation_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!cfg) return <div>Unknown type</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{t("nav.moderation")}</div>
          <h1 className="text-3xl font-bold">{t(cfg.labelKey)}</h1>
        </div>
        {canCreate && (
          <Link
            to="/moderation/$type/new"
            params={{ type }}
            className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground font-semibold px-4 py-2 hover:brightness-110"
          >
            <Plus size={16} /> {t("moderation.new")}
          </Link>
        )}
      </div>

      <div className="card-elevated overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">{t("common.loading")}</div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">{t("moderation.empty")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">{t("moderation.date")}</th>
                <th className="p-3">{t("moderation.teacher")}</th>
                <th className="p-3">{t("moderation.grade")}</th>
                <th className="p-3">{t("moderation.subject")}</th>
                <th className="p-3">{t("moderation.quarter")}/{t("moderation.cycle")}</th>
                <th className="p-3">{t("moderation.percentage")}</th>
                <th className="p-3">{t("moderation.status")}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r: any) => {
                const pct = Number(r.percentage);
                const color =
                  pct >= 85 ? "bg-status-green" : pct >= 70 ? "bg-status-orange" : "bg-status-red";
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3">{r.moderation_date}</td>
                    <td className="p-3">{r.teacher?.full_name || r.teacher?.email || "—"}</td>
                    <td className="p-3">{r.grades?.name ?? "—"}</td>
                    <td className="p-3">{r.subjects?.name ?? "—"}</td>
                    <td className="p-3">Q{r.quarter} · C{r.cycle}</td>
                    <td className="p-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-white text-xs ${color}`}>
                        {pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 capitalize">{r.status}</td>
                    <td className="p-3 text-right">
                      <Link
                        to="/moderation/view/$id"
                        params={{ id: r.id }}
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
