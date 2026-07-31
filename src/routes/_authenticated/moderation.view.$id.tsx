import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { generateModerationPdf } from "@/lib/pdf";
import {
  templateFor,
  scoreToCompliance,
  optionForCompliance,
  computeGridColumns,
  gridPercentBand,
  GRID_PERCENT_CLASSES,
  typeLabelKey,
  type Compliance,
  type GridRow,
} from "@/lib/moderation-templates";
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
      const { data: gridRows } =
        sub.moderation_type === "analysis_of_results"
          ? await supabase.from("analysis_of_results_students").select("*").eq("submission_id", id).order("row_number")
          : { data: [] as never[] };
      const { data: improvementRows } =
        sub.moderation_type === "subject_improvement_plan"
          ? await supabase.from("subject_improvement_items").select("*").eq("submission_id", id).order("sort_order")
          : { data: [] as never[] };
      return { sub, scores: scores ?? [], gridRows: gridRows ?? [], improvementRows: improvementRows ?? [] };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  const { sub, scores, gridRows, improvementRows } = data;
  const modType = sub.moderation_type as ModType;
  const tpl = templateFor(modType);
  const isChecklist = tpl.mode === "checklist";
  const isGrid = tpl.mode === "grid";
  const isList = tpl.mode === "list";
  const showScore = tpl.mode === "scored" || tpl.mode === "stats" || isGrid || (tpl.mode === "checklist" && tpl.showScore);
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

  // Analysis of Results grid: column-wise footer totals/averages are derived
  // here from the stored per-student rows, same helper the create form uses.
  const anyGridRows = gridRows as unknown as Array<{
    row_number: number;
    student_name: string;
    marks: number[];
    row_total: number;
    row_percentage: number;
  }>;
  const gridQuestionMax: (number | null)[] = isGrid ? (((sub as any).question_max_marks as (number | null)[]) ?? []) : [];
  const gridColumnStats = isGrid
    ? computeGridColumns(
        anyGridRows.map((r): GridRow => ({ name: r.student_name, marks: r.marks })),
        gridQuestionMax.length,
      )
    : { totals: [], averages: [] };

  const download = () =>
    generateModerationPdf({
      mode: tpl.mode,
      showPercentage: showScore,
      summaryLabel: tpl.mode === "stats" ? t("pmItems.grade_average") : undefined,
      reportSubtitle: `${t(typeLabelKey(modType))} ${t("moderation.reportWord")}`,
      title:
        isChecklist || isGrid || isList
          ? `${t(typeLabelKey(modType))} — ${t("moderation.term")} ${sub.quarter}`
          : `${t(typeLabelKey(modType))} — Q${sub.quarter} C${sub.cycle}`,
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
      grid: isGrid
        ? {
            className: (sub as any).class_name ?? "",
            term: sub.quarter,
            questionMaxMarks: gridQuestionMax,
            students: anyGridRows.map((r) => ({
              name: r.student_name,
              marks: r.marks,
              total: Number(r.row_total),
              percentage: Number(r.row_percentage),
            })),
            columnTotals: gridColumnStats.totals,
            columnAverages: gridColumnStats.averages,
          }
        : undefined,
      list: isList
        ? (improvementRows as any[]).map((r) => ({
            challenge: r.challenge,
            learnerGroups: (r.learner_groups ?? []).map((g: string) => t(`improvement.${g}`)),
            strategy: r.strategy,
            timeframe: r.timeframe,
            performanceIndicator: r.performance_indicator,
          }))
        : undefined,
    });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{t(typeLabelKey(modType))}</div>
          <h1 className="text-3xl font-bold">
            {isChecklist || isGrid || isList ? `${t("moderation.term")} ${sub.quarter}` : `Q${sub.quarter} · C${sub.cycle} · ${sub.weeks}`}
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
        {isGrid && <Meta label={t("moderation.class")} value={(sub as any).class_name || "—"} />}
        <Meta label={t("moderation.subject")} value={subjectName} />
        {!isGrid && !isList && <Meta label={isChecklist ? t("moderation.moderator") : t("moderation.headOfSubject")} value={hosName} />}
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
      ) : isGrid ? (
        <div className="card-elevated p-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-2 text-left border border-border sticky left-0 bg-muted/50 min-w-[180px]">{t("analysis.studentName")}</th>
                {gridQuestionMax.map((_, i) => (
                  <th key={i} className="p-2 text-center border border-border min-w-[70px]">
                    {t("analysis.question")}{i + 1}
                  </th>
                ))}
                <th className="p-2 text-center border border-border min-w-[80px]">{t("moderation.total")}</th>
                <th className="p-2 text-center border border-border min-w-[70px]">%</th>
              </tr>
              <tr className="bg-muted/30">
                <th className="p-2 text-right text-xs font-normal text-muted-foreground border border-border sticky left-0 bg-muted/30">
                  {t("analysis.outOf")}
                </th>
                {gridQuestionMax.map((v, i) => (
                  <th key={i} className="p-2 text-center border border-border font-normal text-muted-foreground">
                    {v ?? ""}
                  </th>
                ))}
                <th className="border border-border" colSpan={2} />
              </tr>
            </thead>
            <tbody>
              {anyGridRows.map((r) => (
                <tr key={r.row_number} className="border-t border-border">
                  <td className="p-2 border border-border sticky left-0 bg-background">{r.student_name}</td>
                  {gridQuestionMax.map((_, i) => (
                    <td key={i} className="p-2 text-center border border-border">
                      {r.marks[i] ?? ""}
                    </td>
                  ))}
                  <td className="p-2 text-center border border-border font-medium">{Number(r.row_total)}</td>
                  <td className={`p-2 text-center border border-border font-semibold ${GRID_PERCENT_CLASSES[gridPercentBand(Number(r.row_percentage))]}`}>
                    {Number(r.row_percentage).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 font-semibold">
                <td className="p-2 border border-border sticky left-0 bg-muted/30">{t("analysis.totalRow")}</td>
                {gridColumnStats.totals.map((v, i) => (
                  <td key={i} className="p-2 text-center border border-border">{v || ""}</td>
                ))}
                <td className="p-2 text-center border border-border">{Number(sub.total_score)}</td>
                <td className="p-2 text-center border border-border">{Number(sub.percentage).toFixed(1)}%</td>
              </tr>
              <tr className="bg-muted/30 font-semibold">
                <td className="p-2 border border-border sticky left-0 bg-muted/30">{t("analysis.averageRow")}</td>
                {gridColumnStats.averages.map((v, i) => (
                  <td key={i} className="p-2 text-center border border-border">{v ? v.toFixed(1) : ""}</td>
                ))}
                <td className="border border-border" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : isList ? (
        <div className="space-y-4">
          {improvementRows.length === 0 ? (
            <div className="card-elevated p-6 text-sm text-muted-foreground">{t("history.empty")}</div>
          ) : (
            (improvementRows as any[]).map((r, i) => (
              <div key={r.id ?? i} className="card-elevated p-5 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("improvement.challenge")}</div>
                  <div className="text-sm whitespace-pre-wrap">{r.challenge}</div>
                </div>
                {r.learner_groups?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.learner_groups.map((g: string) => (
                      <span key={g} className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        {t(`improvement.${g}`)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("improvement.strategy")}</div>
                    <div className="text-sm whitespace-pre-wrap">{r.strategy || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("improvement.performanceIndicator")}</div>
                    <div className="text-sm whitespace-pre-wrap">{r.performance_indicator || "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("improvement.timeframe")}</div>
                  <div className="text-sm">{r.timeframe || "—"}</div>
                </div>
              </div>
            ))
          )}
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
