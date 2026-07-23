import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { generateModerationPdf } from "@/lib/pdf";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/moderation/view/$id")({
  component: ViewModeration,
  head: () => ({
    meta: [{ title: "Moderation — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

function ViewModeration() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/_authenticated/moderation/view/$id" });

  const { data, isLoading } = useQuery({
    queryKey: ["submission", id],
    queryFn: async () => {
      const { data: sub, error } = await supabase
        .from("moderation_submissions")
        .select(
          "*, grades(name), subjects(name), teacher:profiles!moderation_submissions_teacher_id_fkey(full_name, email), hos:profiles!moderation_submissions_head_of_subject_id_fkey(full_name, email)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      const { data: scores } = await supabase
        .from("moderation_scores")
        .select("*")
        .eq("submission_id", id)
        .order("sort_order");
      return { sub, scores: scores ?? [] };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  const { sub, scores } = data;
  const pct = Number(sub.percentage);
  const color = pct >= 85 ? "bg-status-green" : pct >= 70 ? "bg-status-orange" : "bg-status-red";

  const download = () =>
    generateModerationPdf({
      title: `${sub.moderation_type.replace("_", " ")} — Q${sub.quarter} C${sub.cycle}`,
      teacherName: (sub as any).teacher?.full_name || (sub as any).teacher?.email || "—",
      grade: (sub as any).grades?.name || "—",
      subject: (sub as any).subjects?.name || "—",
      academicYear: sub.academic_year,
      quarter: sub.quarter,
      cycle: sub.cycle,
      weeks: sub.weeks,
      date: sub.moderation_date,
      headOfSubject: (sub as any).hos?.full_name || (sub as any).hos?.email || "—",
      scores: scores.map((s) => ({
        label: s.item_label,
        score: Number(s.score),
        max: Number(s.max_score),
        comment: s.comment ?? "",
      })),
      totalScore: Number(sub.total_score),
      maxScore: Number(sub.max_score),
      percentage: Number(sub.percentage),
      generalComments: sub.general_comments ?? undefined,
      recommendations: sub.recommendations ?? undefined,
    });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground capitalize">
            {sub.moderation_type.replace("_", " ")}
          </div>
          <h1 className="text-3xl font-bold">
            Q{sub.quarter} · C{sub.cycle} · {sub.weeks}
          </h1>
          <div className="text-sm text-muted-foreground mt-1">
            {sub.moderation_date} · {sub.academic_year}
          </div>
        </div>
        <button
          onClick={download}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
        >
          <Download size={16} /> {t("moderation.downloadPdf")}
        </button>
      </div>

      {sub.status === "submitted" && (
        <div className="rounded-md bg-status-green/10 border border-status-green/30 px-4 py-2 text-sm">
          {t("moderation.submittedReadOnly")}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm card-elevated p-6">
        <Meta label={t("moderation.teacher")} value={(sub as any).teacher?.full_name || (sub as any).teacher?.email || "—"} />
        <Meta label={t("moderation.grade")} value={(sub as any).grades?.name ?? "—"} />
        <Meta label={t("moderation.subject")} value={(sub as any).subjects?.name ?? "—"} />
        <Meta label={t("moderation.headOfSubject")} value={(sub as any).hos?.full_name || (sub as any).hos?.email || "—"} />
        <Meta label={t("moderation.status")} value={sub.status} />
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">{t("moderation.comment")}</th>
              <th className="text-right p-3">{t("moderation.score")}</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-3 font-medium">{s.item_label}</td>
                <td className="p-3 text-muted-foreground">{s.comment || "—"}</td>
                <td className="p-3 text-right font-semibold">
                  {Number(s.score)} / {Number(s.max_score)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-elevated p-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t("moderation.total")}:{" "}
          <span className="text-foreground font-semibold">
            {Number(sub.total_score)} / {Number(sub.max_score)}
          </span>
        </div>
        <div className={`rounded-md text-white px-4 py-2 font-bold text-lg ${color}`}>
          {pct.toFixed(1)}%
        </div>
      </div>

      {sub.general_comments && (
        <div className="card-elevated p-6">
          <div className="font-semibold mb-2">{t("moderation.generalComments")}</div>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{sub.general_comments}</p>
        </div>
      )}
      {sub.recommendations && (
        <div className="card-elevated p-6">
          <div className="font-semibold mb-2">{t("moderation.recommendations")}</div>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{sub.recommendations}</p>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
