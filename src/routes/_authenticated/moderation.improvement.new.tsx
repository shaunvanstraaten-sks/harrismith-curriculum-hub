import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LEARNER_GROUPS, type LearnerGroup } from "@/lib/moderation-templates";

const GRADE_NAME_RE = /^Grade [4-7]$/;

type RowInput = {
  challenge: string;
  learnerGroups: LearnerGroup[];
  strategy: string;
  timeframe: string;
  performanceIndicator: string;
};

const emptyRow = (): RowInput => ({ challenge: "", learnerGroups: [], strategy: "", timeframe: "", performanceIndicator: "" });

export const Route = createFileRoute("/_authenticated/moderation/improvement/new")({
  component: NewSubjectImprovementPlan,
  head: () => ({
    meta: [{ title: "New Subject Improvement Plan — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

function NewSubjectImprovementPlan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [subjectId, setSubjectId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [term, setTerm] = useState<number | null>(null);
  const [rows, setRows] = useState<RowInput[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [errors, setErrors] = useState<{ subject?: boolean; grade?: boolean; term?: boolean; rows?: boolean }>({});
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

  const filledRows = useMemo(() => rows.filter((r) => r.challenge.trim() !== ""), [rows]);

  const updateRow = (idx: number, patch: Partial<RowInput>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const toggleLearnerGroup = (idx: number, group: LearnerGroup) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const has = r.learnerGroups.includes(group);
        return { ...r, learnerGroups: has ? r.learnerGroups.filter((g) => g !== group) : [...r.learnerGroups, group] };
      }),
    );
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const save = async (submit: boolean) => {
    if (!user) return;

    if (submit) {
      const e: typeof errors = {};
      if (!subjectId) e.subject = true;
      if (!gradeId) e.grade = true;
      if (!term) e.term = true;
      if (filledRows.length === 0) e.rows = true;
      setErrors(e);
      if (Object.keys(e).length > 0) {
        if (e.rows) toast.error(t("improvement.atLeastOneChallenge"));
        else toast.error(t("improvement.selectSubjectGradeTerm"));
        return;
      }
    }

    const payload = {
      moderation_type: "subject_improvement_plan" as const,
      academic_year: new Date().getFullYear(),
      quarter: term ?? 1,
      cycle: 1,
      weeks: "-",
      moderation_date: moderationDate,
      teacher_id: user.id,
      head_of_subject_id: null,
      subject_id: subjectId || null,
      grade_id: gradeId || null,
      total_score: 0,
      max_score: 0,
      percentage: 0,
      status: submit ? ("submitted" as const) : ("draft" as const),
      submitted_at: submit ? new Date().toISOString() : null,
      created_by: user.id,
    };

    const { data: sub, error } = await supabase.from("moderation_submissions").insert(payload).select("id").single();
    if (error) {
      toast.error(error.message);
      return;
    }

    if (filledRows.length > 0) {
      const itemRows = filledRows.map((r, idx) => ({
        submission_id: sub.id,
        sort_order: idx,
        challenge: r.challenge.trim(),
        learner_groups: r.learnerGroups,
        strategy: r.strategy.trim(),
        timeframe: r.timeframe.trim(),
        performance_indicator: r.performanceIndicator.trim(),
      }));
      const { error: rErr } = await supabase.from("subject_improvement_items").insert(itemRows);
      if (rErr) {
        toast.error(rErr.message);
        return;
      }
    }

    qc.invalidateQueries({ queryKey: ["dashboard-submissions"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    const name = t("dashboard.subjectImprovementPlan");
    toast.success(submit ? t("moderation.submittedToast", { name }) : t("moderation.draftToast", { name }));
    navigate({ to: "/moderation/view/$id", params: { id: sub.id } });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="text-sm text-muted-foreground">{t("nav.moderation")}</div>
        <h1 className="text-3xl font-bold">{t("dashboard.subjectImprovementPlan")}</h1>
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

        <div>
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

      <section className="space-y-4">
        {errors.rows && <div className="text-sm text-status-red">{t("improvement.atLeastOneChallenge")}</div>}
        {rows.map((row, idx) => (
          <div key={idx} className="card-elevated p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium">{t("improvement.challenge")}</label>
                <textarea
                  value={row.challenge}
                  onChange={(e) => updateRow(idx, { challenge: e.target.value })}
                  placeholder={t("improvement.challengePlaceholder")}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                />
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="mt-6 rounded-md border border-input p-2 text-muted-foreground hover:bg-accent hover:text-status-red"
                  aria-label={t("improvement.removeRow")}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium">{t("improvement.learnerGroups")}</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {LEARNER_GROUPS.map((g) => {
                  const active = row.learnerGroups.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleLearnerGroup(idx, g)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                        active ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {t(`improvement.${g}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">{t("improvement.strategy")}</span>
                <textarea
                  value={row.strategy}
                  onChange={(e) => updateRow(idx, { strategy: e.target.value })}
                  placeholder={t("improvement.strategyPlaceholder")}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">{t("improvement.performanceIndicator")}</span>
                <textarea
                  value={row.performanceIndicator}
                  onChange={(e) => updateRow(idx, { performanceIndicator: e.target.value })}
                  placeholder={t("improvement.performanceIndicatorPlaceholder")}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                />
              </label>
            </div>

            <label className="block max-w-xs">
              <span className="text-sm font-medium">{t("improvement.timeframe")}</span>
              <input
                value={row.timeframe}
                onChange={(e) => updateRow(idx, { timeframe: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus size={16} /> {t("improvement.addRow")}
        </button>
      </section>

      <div className="card-elevated p-6 flex items-center justify-end gap-2">
        <button onClick={() => save(false)} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          {t("moderation.saveDraft")}
        </button>
        <button onClick={() => save(true)} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:brightness-110">
          {t("moderation.submit")}
        </button>
      </div>
    </div>
  );
}
