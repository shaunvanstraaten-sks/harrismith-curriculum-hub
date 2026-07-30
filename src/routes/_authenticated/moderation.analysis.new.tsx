import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { computeGridRow, computeGridColumns, gridPercentBand, GRID_PERCENT_CLASSES, type GridRow } from "@/lib/moderation-templates";

const MAX_QUESTIONS = 10;
const MAX_STUDENTS = 10;
const GRADE_NAME_RE = /^Grade [4-7]$/;

type StudentInput = { name: string; marks: (number | null)[] };

const emptyStudents = (): StudentInput[] =>
  Array.from({ length: MAX_STUDENTS }, () => ({ name: "", marks: Array(MAX_QUESTIONS).fill(null) }));

export const Route = createFileRoute("/_authenticated/moderation/analysis/new")({
  component: NewAnalysisOfResults,
  head: () => ({
    meta: [{ title: "New Analysis of Results — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

function NewAnalysisOfResults() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [subjectId, setSubjectId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [className, setClassName] = useState("");
  const [term, setTerm] = useState<number | null>(null);
  const [questionMax, setQuestionMax] = useState<(number | null)[]>(Array(MAX_QUESTIONS).fill(null));
  const [students, setStudents] = useState<StudentInput[]>(emptyStudents());
  const [errors, setErrors] = useState<{ subject?: boolean; grade?: boolean; term?: boolean; students?: boolean }>({});
  const moderationDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const { data: grades } = useQuery({
    queryKey: ["grades"],
    queryFn: async () => (await supabase.from("grades").select("id, name").order("sort_order")).data ?? [],
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("id, name").order("name")).data ?? [],
  });
  const gradeOptions = (grades ?? []).filter((g) => GRADE_NAME_RE.test(g.name));

  const filledStudents = useMemo(
    () =>
      students
        .map((s, idx) => ({ idx, ...s }))
        .filter((s) => s.name.trim() !== ""),
    [students],
  );

  const rowStats = useMemo(
    () => filledStudents.map((s) => ({ ...s, ...computeGridRow(s.marks, questionMax) })),
    [filledStudents, questionMax],
  );

  const gridRows: GridRow[] = useMemo(
    () => filledStudents.map((s) => ({ name: s.name, marks: s.marks })),
    [filledStudents],
  );
  const columns = useMemo(() => computeGridColumns(gridRows, MAX_QUESTIONS), [gridRows]);

  const classTotal = rowStats.reduce((a, b) => a + b.total, 0);
  const classMax = rowStats.reduce((a, b) => a + b.max, 0);
  const classAvgPct = rowStats.length ? rowStats.reduce((a, b) => a + b.percentage, 0) / rowStats.length : 0;

  const setMark = (rowIdx: number, qIdx: number, raw: string) => {
    const val = raw === "" ? null : Math.max(0, Number(raw));
    setStudents((prev) => {
      const next = [...prev];
      const marks = [...next[rowIdx].marks];
      marks[qIdx] = Number.isFinite(val) ? val : null;
      next[rowIdx] = { ...next[rowIdx], marks };
      return next;
    });
  };
  const setName = (rowIdx: number, name: string) => {
    setStudents((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], name };
      return next;
    });
  };
  const setQMax = (qIdx: number, raw: string) => {
    const val = raw === "" ? null : Math.max(0, Number(raw));
    setQuestionMax((prev) => {
      const next = [...prev];
      next[qIdx] = Number.isFinite(val) ? val : null;
      return next;
    });
  };

  const save = async (submit: boolean) => {
    if (!user) return;

    if (submit) {
      const e: typeof errors = {};
      if (!subjectId) e.subject = true;
      if (!gradeId) e.grade = true;
      if (!term) e.term = true;
      if (filledStudents.length === 0) e.students = true;
      setErrors(e);
      if (Object.keys(e).length > 0) {
        if (e.students) toast.error(t("analysis.atLeastOneStudent"));
        else toast.error(t("analysis.selectSubjectGradeTerm"));
        return;
      }
    }

    const payload = {
      moderation_type: "analysis_of_results" as const,
      academic_year: new Date().getFullYear(),
      quarter: term ?? 1,
      cycle: 1,
      weeks: "-",
      moderation_date: moderationDate,
      teacher_id: user.id,
      head_of_subject_id: null,
      subject_id: subjectId || null,
      grade_id: gradeId || null,
      class_name: className || null,
      question_max_marks: questionMax,
      total_score: classTotal,
      max_score: classMax,
      percentage: classAvgPct,
      status: submit ? ("submitted" as const) : ("draft" as const),
      submitted_at: submit ? new Date().toISOString() : null,
      created_by: user.id,
    };

    const { data: sub, error } = await supabase.from("moderation_submissions").insert(payload).select("id").single();
    if (error) {
      toast.error(error.message);
      return;
    }

    if (rowStats.length > 0) {
      const rows = rowStats.map((s) => ({
        submission_id: sub.id,
        row_number: s.idx + 1,
        student_name: s.name.trim(),
        marks: s.marks,
        row_total: s.total,
        row_percentage: s.percentage,
      }));
      const { error: rErr } = await supabase.from("analysis_of_results_students").insert(rows);
      if (rErr) {
        toast.error(rErr.message);
        return;
      }
    }

    qc.invalidateQueries({ queryKey: ["dashboard-submissions"] });
    qc.invalidateQueries({ queryKey: ["my-completed"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    toast.success(submit ? "Submitted" : "Saved as draft");
    navigate({ to: "/moderation/view/$id", params: { id: sub.id } });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="text-sm text-muted-foreground">{t("nav.moderation")}</div>
        <h1 className="text-3xl font-bold">{t("dashboard.analysisOfResults")}</h1>
      </div>

      <section className="card-elevated p-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="block text-sm font-medium">{t("moderation.date")}</label>
          <div className="mt-1 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
            {moderationDate}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">{t("moderation.subject")}</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${errors.subject ? "border-status-red" : "border-input"}`}
          >
            <option value="">—</option>
            {(subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.subject && <div className="mt-1 text-xs text-status-red">{t("analysis.required")}</div>}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium">{t("moderation.grade")}</label>
            <select
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${errors.grade ? "border-status-red" : "border-input"}`}
            >
              <option value="">—</option>
              {gradeOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {errors.grade && <div className="mt-1 text-xs text-status-red">{t("analysis.required")}</div>}
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium">{t("moderation.class")}</label>
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder={t("analysis.classPlaceholder")}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">{t("moderation.term")}</label>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setTerm(q)}
                className={`flex-1 rounded-md border px-2 py-2 text-sm font-medium transition ${
                  term === q
                    ? "bg-primary text-primary-foreground border-primary"
                    : `bg-background hover:bg-accent ${errors.term ? "border-status-red" : "border-input"}`
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          {errors.term && <div className="mt-1 text-xs text-status-red">{t("analysis.required")}</div>}
        </div>
      </section>

      <section className="card-elevated p-4 overflow-x-auto">
        {errors.students && <div className="mb-3 text-sm text-status-red">{t("analysis.atLeastOneStudent")}</div>}
        <table className="w-full text-sm border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 text-left border border-border sticky left-0 bg-muted/50 min-w-[180px]">
                {t("analysis.studentName")}
              </th>
              {Array.from({ length: MAX_QUESTIONS }, (_, i) => (
                <th key={i} className="p-2 text-center border border-border min-w-[70px]">
                  {t("analysis.question")}
                  {i + 1}
                </th>
              ))}
              <th className="p-2 text-center border border-border min-w-[80px]">{t("moderation.total")}</th>
              <th className="p-2 text-center border border-border min-w-[70px]">%</th>
            </tr>
            <tr className="bg-muted/30">
              <th className="p-2 text-right text-xs font-normal text-muted-foreground border border-border sticky left-0 bg-muted/30">
                {t("analysis.outOf")}
              </th>
              {questionMax.map((v, i) => (
                <th key={i} className="p-1 border border-border">
                  <input
                    type="number"
                    min={0}
                    value={v ?? ""}
                    onChange={(e) => setQMax(i, e.target.value)}
                    className="w-full rounded border border-input bg-background px-1 py-1 text-center text-sm"
                  />
                </th>
              ))}
              <th className="border border-border" colSpan={2} />
            </tr>
          </thead>
          <tbody>
            {students.map((row, rIdx) => {
              const { total, percentage } = computeGridRow(row.marks, questionMax);
              return (
                <tr key={rIdx} className="border-t border-border">
                  <td className="p-1 border border-border sticky left-0 bg-background">
                    <input
                      value={row.name}
                      onChange={(e) => setName(rIdx, e.target.value)}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                    />
                  </td>
                  {row.marks.map((m, qIdx) => (
                    <td key={qIdx} className="p-1 border border-border">
                      <input
                        type="number"
                        min={0}
                        max={questionMax[qIdx] ?? undefined}
                        value={m ?? ""}
                        onChange={(e) => setMark(rIdx, qIdx, e.target.value)}
                        className="w-full rounded border border-input bg-background px-1 py-1 text-center text-sm"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-center border border-border font-medium">
                    {row.name.trim() ? total : "—"}
                  </td>
                  <td
                    className={`p-2 text-center border border-border font-semibold ${
                      row.name.trim() ? GRID_PERCENT_CLASSES[gridPercentBand(percentage)] : ""
                    }`}
                  >
                    {row.name.trim() ? `${percentage.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 font-semibold">
              <td className="p-2 border border-border sticky left-0 bg-muted/30">{t("analysis.totalRow")}</td>
              {columns.totals.map((v, i) => (
                <td key={i} className="p-2 text-center border border-border">
                  {v || "—"}
                </td>
              ))}
              <td className="p-2 text-center border border-border">{classTotal || "—"}</td>
              <td className="p-2 text-center border border-border">{rowStats.length ? `${classAvgPct.toFixed(1)}%` : "—"}</td>
            </tr>
            <tr className="bg-muted/30 font-semibold">
              <td className="p-2 border border-border sticky left-0 bg-muted/30">{t("analysis.averageRow")}</td>
              {columns.averages.map((v, i) => (
                <td key={i} className="p-2 text-center border border-border">
                  {v ? v.toFixed(1) : "—"}
                </td>
              ))}
              <td className="border border-border" colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </section>

      <div className="card-elevated p-6 flex items-center justify-between">
        <div className="text-sm">
          <div className="text-muted-foreground">
            {t("moderation.total")}: <span className="font-semibold text-foreground">{classTotal} / {classMax}</span>
          </div>
          <div className="text-2xl font-bold">{rowStats.length ? classAvgPct.toFixed(1) : "0.0"}%</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save(false)} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
            {t("moderation.saveDraft")}
          </button>
          <button onClick={() => save(true)} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:brightness-110">
            {t("moderation.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
