import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { generateModerationPdf } from "@/lib/pdf";
import { templateFor, scoreToCompliance, optionForCompliance, type Compliance } from "@/lib/moderation-templates";
import type { Database } from "@/integrations/supabase/types";
import { Download } from "lucide-react";

type ModType = Database["public"]["Enums"]["moderation_type"];

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
      const { data: scores } = await supabase.from("moderation_scores").select("*").eq("submission_id", id).order("sort_order");
      return { sub, scores: scores ?? [] };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  const { sub, scores } = data;
  const modType = sub.moderation_type as ModType;
  const tpl = templateFor(modType);
  const isChecklist = tpl.mode === "checklist";
  const showScore = tpl.mode === "scored" || tpl.mode === "stats" || (tpl.mode === "checklist" && tpl.showScore);
  const learnersField = tpl.mode === "checklist" && tpl.learnersField;
  const anyS = sub as any;

  const teacherName = anyS.teacher?.full_name || anyS.teacher?.email || "—";
  const hosName = anyS.hos?.full_name || anyS.hos?.email || "—";
  const gradeName = anyS.grades?.name ?? "—";
  const subjectName = anyS.subjects?.name ?? "—";
  const teacherLabel = tpl.teacherLabelKey ? t(tpl.teacherLabelKey) : t("moderation.teacher");
  const optLabel = (v: string | null) => (v ? t(`opts.${v}`, v) : "—");

  const pct = Number(sub.percentage);
  const color = pct >= 85 ? "bg-status-green" : pct >= 70 ? "bg-status-orange" : "bg-status-red";

  // Rebuild the grouped checklist from the template order + stored score/max.
  const scoreByKey = Object.fromEntries(scores.map((s) => [s.item_key, s]));
  const checklistSections =
    tpl.mode === "checklist"
      ? tpl.sections.map((sec) => ({
          title: t(sec.titleKey),
          items: sec.items.map((it) => {
            const row = scoreByKey[it.key];
            const compliance: Compliance = row ? scoreToCompliance(Number(row.score), Number(row.max_score)) : "na";
            const opt = optionForCompliance(it.scale, compliance);
            return { label: t(it.labelKey), answer: opt ? t(opt.labelKey) : "—", compliance };
          }),
        }))
      : [];

  // Post-Moderation statistics, grouped for display and the PDF.
  const statsSections =
    tpl.mode === "stats"
      ? (["count", "percent"] as const).map((kind) => ({
          title: t(kind === "count" ? "pmSections.counts" : "pmSections.averages"),
          items: tpl.fields
            .filter((f) => f.kind === kind)
            .map((f) => {
              const row = scoreByKey[f.key];
              const v = row ? Number(row.score) : null;
              return {
                label: t(f.labelKey),
                answer: v === null ? "—" : kind === "percent" ? `${v.toFixed(1)}%` : String(v),
              };
            }),
        }))
      : [];

  const download = () =>
    generateModerationPdf({
      mode: tpl.mode,
      showPercentage: showScore,
      summaryLabel: tpl.mode === "stats" ? t("pmItems.grade_average") : undefined,
      title: isChecklist
        ? `${t(`dashboard.${modType === "book_control" ? "bookControl" : "preModeration"}`)} — ${t("moderation.term")} ${sub.quarter}`
        : `${sub.moderation_type.replace("_", " ")} — Q${sub.quarter} C${sub.cycle}`,
      teacherName,
      grade: gradeName,
      subject: subjectName,
      academicYear: sub.academic_year,
      quarter: sub.quarter,
      cycle: sub.cycle,
      weeks: sub.weeks,
      date: sub.moderation_date,
      headOfSubject: hosName,
      teacherLabel,
      extraMeta: [
        ...(sub.type_of_moderation ? ([[t("moderation.typeOfModeration"), optLabel(sub.type_of_moderation)]] as [string, string][]) : []),
        ...(sub.type_of_assessment ? ([[t("moderation.typeOfAssessment"), optLabel(sub.type_of_assessment)]] as [string, string][]) : []),
      ],
      scores: scores.map((s) => ({ label: s.item_label, score: Number(s.score), max: Number(s.max_score), comment: s.comment ?? "" })),
      checklistSections: tpl.mode === "stats" ? statsSections : checklistSections,
      totalScore: Number(sub.total_score),
      maxScore: Number(sub.max_score),
      percentage: Number(sub.percentage),
      generalComments: sub.general_comments ?? undefined,
      recommendations: sub.recommendations ?? undefined,
      learnersLabel: learnersField ? t("moderation.learnersChecked") : undefined,
    });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground capitalize">{sub.moderation_type.replace("_", " ")}</div>
          <h1 className="text-3xl font-bold">
            {isChecklist ? `${t("moderation.term")} ${sub.quarter}` : `Q${sub.quarter} · C${sub.cycle} · ${sub.weeks}`}
          </h1>
          <div className="text-sm text-muted-foreground mt-1">{sub.moderation_date} · {sub.academic_year}</div>
        </div>
        <button onClick={download} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
          <Download size={16} /> {t("moderation.downloadPdf")}
        </button>
      </div>

      {sub.status === "submitted" && (
        <div className="rounded-md bg-status-green/10 border border-status-green/30 px-4 py-2 text-sm">{t("moderation.submittedReadOnly")}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm card-elevated p-6">
        <Meta label={teacherLabel} value={teacherName} />
        <Meta label={t("moderation.grade")} value={gradeName} />
        <Meta label={t("moderation.subject")} value={subjectName} />
        <Meta label={isChecklist ? t("moderation.moderator") : t("moderation.headOfSubject")} value={hosName} />
        {sub.type_of_moderation && <Meta label={t("moderation.typeOfModeration")} value={optLabel(sub.type_of_moderation)} />}
        {sub.type_of_assessment && <Meta label={t("moderation.typeOfAssessment")} value={optLabel(sub.type_of_assessment)} />}
        <Meta label={t("moderation.status")} value={sub.status} />
      </div>

      {tpl.mode === "checklist" ? (
        <div className="space-y-4">
          {checklistSections.map((sec) => (
            <div key={sec.title} className="card-elevated overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">{sec.title}</div>
              <table className="w-full text-sm">
                <tbody>
                  {sec.items.map((it, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3">{it.label}</td>
                      <td className="p-3 text-right w-40">
                        <AnswerBadge compliance={it.compliance} label={it.answer} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : tpl.mode === "stats" ? (
        <div className="space-y-4">
          {statsSections.map((sec) => (
            <div key={sec.title} className="card-elevated overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">{sec.title}</div>
              <table className="w-full text-sm">
                <tbody>
                  {sec.items.map((it, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3">{it.label}</td>
                      <td className="p-3 text-right w-40 font-semibold">{it.answer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
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
                  <td className="p-3 text-right font-semibold">{Number(s.score)} / {Number(s.max_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showScore && (
        <div className="card-elevated p-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {tpl.mode === "stats" ? (
              t("pmItems.grade_average")
            ) : (
              <>
                {t("moderation.total")}:{" "}
                <span className="text-foreground font-semibold">
                  {Number(sub.total_score)} / {Number(sub.max_score)}
                </span>
              </>
            )}
          </div>
          <div className={`rounded-md text-white px-4 py-2 font-bold text-lg ${color}`}>{pct.toFixed(1)}%</div>
        </div>
      )}

      {learnersField && sub.recommendations && (
        <div className="card-elevated p-6">
          <div className="font-semibold mb-2">{t("moderation.learnersChecked")}</div>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{sub.recommendations}</p>
        </div>
      )}
      {sub.general_comments && (
        <div className="card-elevated p-6">
          <div className="font-semibold mb-2">
            {learnersField
              ? t("moderation.otherComments")
              : tpl.mode === "stats"
                ? t(tpl.notesLabelKey)
                : isChecklist
                  ? t("moderation.comments")
                  : t("moderation.generalComments")}
          </div>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{sub.general_comments}</p>
        </div>
      )}
      {!learnersField && sub.recommendations && (
        <div className="card-elevated p-6">
          <div className="font-semibold mb-2">{t("moderation.recommendations")}</div>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{sub.recommendations}</p>
        </div>
      )}
    </div>
  );
}

function AnswerBadge({ compliance, label }: { compliance: Compliance; label: string }) {
  const cls =
    compliance === "compliant"
      ? "bg-status-green/15 text-status-green border-status-green/30"
      : compliance === "flag"
        ? "bg-status-red/15 text-status-red border-status-red/30"
        : "bg-muted text-muted-foreground border-border";
  return <span className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
