import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  templateFor,
  checklistItemsFlat,
  answerToScore,
  type ChecklistAnswer,
  type MetaField,
} from "@/lib/moderation-templates";
import type { Database } from "@/integrations/supabase/types";

type ModType = Database["public"]["Enums"]["moderation_type"];

const TYPE_MAP: Record<string, { db: ModType; labelKey: string }> = {
  pre: { db: "pre_moderation", labelKey: "dashboard.preModeration" },
  post: { db: "post_moderation", labelKey: "dashboard.postModeration" },
  book: { db: "book_control", labelKey: "dashboard.bookControl" },
};

export const Route = createFileRoute("/_authenticated/moderation/$type/new")({
  component: NewModeration,
  head: () => ({
    meta: [{ title: "New moderation — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

function NewModeration() {
  const { t } = useTranslation();
  const { type } = useParams({ from: "/_authenticated/moderation/$type/new" });
  const cfg = TYPE_MAP[type];
  const navigate = useNavigate();
  const { user } = useAuth();
  const tpl = useMemo(() => (cfg ? templateFor(cfg.db) : null), [cfg]);
  const scoredItems = tpl?.mode === "scored" ? tpl.items : [];
  const checklist = tpl?.mode === "checklist" ? checklistItemsFlat(tpl) : [];

  const [state, setState] = useState({
    academic_year: new Date().getFullYear(),
    quarter: 1,
    cycle: 1,
    weeks: "1-2",
    moderation_date: new Date().toISOString().slice(0, 10),
    teacher_id: "",
    subject_id: "",
    grade_id: "",
    type_of_moderation: "",
    type_of_assessment: "",
    general_comments: "",
    recommendations: "",
  });

  const [scores, setScores] = useState<Record<string, { score: number; comment: string }>>(
    () => Object.fromEntries(scoredItems.map((i) => [i.key, { score: 0, comment: "" }])),
  );
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer>>({});

  const { data: grades } = useQuery({
    queryKey: ["grades"],
    queryFn: async () => (await supabase.from("grades").select("id, name").order("sort_order")).data ?? [],
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("id, name").order("name")).data ?? [],
  });
  const { data: teachers } = useQuery({
    queryKey: ["teacher-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      return data ?? [];
    },
  });

  const totalMax = scoredItems.reduce((a, b) => a + b.maxScore, 0);
  const total = scoredItems.reduce((a, b) => a + (scores[b.key]?.score ?? 0), 0);
  const percentage = totalMax ? (total / totalMax) * 100 : 0;

  const save = async (submit: boolean) => {
    if (!cfg || !tpl || !user) return;
    if (!state.teacher_id || !state.subject_id || !state.grade_id) {
      toast.error("Please select teacher, subject and grade.");
      return;
    }
    if (tpl.mode === "checklist" && (!state.type_of_moderation || !state.type_of_assessment)) {
      toast.error("Please select the type of moderation and type of assessment.");
      return;
    }

    // Build the per-item rows + totals (checklist encodes Yes/No/N-A into score/max_score).
    let rowTotal = 0;
    let rowMax = 0;
    const rowTemplates: Array<{ item_key: string; item_label: string; score: number; max_score: number; comment: string }> = [];

    if (tpl.mode === "scored") {
      scoredItems.forEach((it) => {
        const sc = scores[it.key]?.score ?? 0;
        rowTotal += sc;
        rowMax += it.maxScore;
        rowTemplates.push({ item_key: it.key, item_label: t(it.labelKey), score: sc, max_score: it.maxScore, comment: scores[it.key]?.comment ?? "" });
      });
    } else {
      if (submit) {
        const unanswered = checklist.filter((it) => !answers[it.key]);
        if (unanswered.length) {
          toast.error(`Please answer all ${checklist.length} checklist items (${unanswered.length} remaining).`);
          return;
        }
      }
      checklist.forEach((it) => {
        const { score, max } = answerToScore(answers[it.key] ?? "na");
        rowTotal += score;
        rowMax += max;
        rowTemplates.push({ item_key: it.key, item_label: t(it.labelKey), score, max_score: max, comment: "" });
      });
    }

    const pct = rowMax ? (rowTotal / rowMax) * 100 : 0;

    const payload = {
      moderation_type: cfg.db,
      academic_year: Number(state.academic_year),
      quarter: Number(state.quarter),
      cycle: tpl.metaFields.includes("cycle") ? Number(state.cycle) : 1,
      weeks: tpl.metaFields.includes("weeks") ? state.weeks : "-",
      moderation_date: state.moderation_date,
      teacher_id: state.teacher_id,
      head_of_subject_id: user.id,
      subject_id: state.subject_id,
      grade_id: state.grade_id,
      type_of_moderation: state.type_of_moderation || null,
      type_of_assessment: state.type_of_assessment || null,
      total_score: rowTotal,
      max_score: rowMax,
      percentage: pct,
      status: submit ? ("submitted" as const) : ("draft" as const),
      general_comments: state.general_comments || null,
      recommendations: state.recommendations || null,
      submitted_at: submit ? new Date().toISOString() : null,
      created_by: user.id,
    };

    const { data: sub, error } = await supabase
      .from("moderation_submissions")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = rowTemplates.map((r, idx) => ({ ...r, submission_id: sub.id, sort_order: idx }));
    const { error: sErr } = await supabase.from("moderation_scores").insert(rows);
    if (sErr) {
      toast.error(sErr.message);
      return;
    }
    toast.success(submit ? "Submitted" : "Saved as draft");
    navigate({ to: "/moderation/view/$id", params: { id: sub.id } });
  };

  if (!cfg || !tpl) return <div>Unknown type</div>;

  const renderMeta = (field: MetaField) => {
    switch (field) {
      case "academic_year":
        return <NumberField key={field} label={t("moderation.academicYear")} value={state.academic_year} onChange={(v) => setState({ ...state, academic_year: v })} />;
      case "quarter":
        return <SelectField key={field} label={t("moderation.quarter")} value={String(state.quarter)} options={["1", "2", "3", "4"]} onChange={(v) => setState({ ...state, quarter: Number(v) })} />;
      case "term":
        return <SelectField key={field} label={t("moderation.term")} value={String(state.quarter)} options={["1", "2", "3", "4"]} onChange={(v) => setState({ ...state, quarter: Number(v) })} />;
      case "cycle":
        return <SelectField key={field} label={t("moderation.cycle")} value={String(state.cycle)} options={["1", "2", "3", "4"]} onChange={(v) => setState({ ...state, cycle: Number(v) })} />;
      case "weeks":
        return <TextField key={field} label={t("moderation.weeks")} value={state.weeks} onChange={(v) => setState({ ...state, weeks: v })} />;
      case "moderation_date":
        return <DateField key={field} label={t("moderation.date")} value={state.moderation_date} onChange={(v) => setState({ ...state, moderation_date: v })} />;
      case "grade":
        return <SelectField key={field} label={t("moderation.grade")} value={state.grade_id} options={(grades ?? []).map((g) => ({ value: g.id, label: g.name }))} onChange={(v) => setState({ ...state, grade_id: v })} />;
      case "subject":
        return <SelectField key={field} label={t("moderation.subject")} value={state.subject_id} options={(subjects ?? []).map((s) => ({ value: s.id, label: s.name }))} onChange={(v) => setState({ ...state, subject_id: v })} />;
      case "teacher":
        return <SelectField key={field} label={tpl.mode === "checklist" ? t("moderation.examiner") : t("moderation.teacher")} value={state.teacher_id} options={(teachers ?? []).map((tp) => ({ value: tp.id, label: tp.full_name || tp.email || "—" }))} onChange={(v) => setState({ ...state, teacher_id: v })} />;
      case "type_of_moderation":
        return <SelectField key={field} label={t("moderation.typeOfModeration")} value={state.type_of_moderation} options={[{ value: "school", label: t("opts.school") }, { value: "department", label: t("opts.department") }]} onChange={(v) => setState({ ...state, type_of_moderation: v })} />;
      case "type_of_assessment":
        return <SelectField key={field} label={t("moderation.typeOfAssessment")} value={state.type_of_assessment} options={[{ value: "test", label: t("opts.test") }, { value: "exam", label: t("opts.exam") }, { value: "assignment", label: t("opts.assignment") }]} onChange={(v) => setState({ ...state, type_of_assessment: v })} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="text-sm text-muted-foreground">{t(cfg.labelKey)}</div>
        <h1 className="text-3xl font-bold">{t("moderation.new")}</h1>
      </div>

      <section className="card-elevated p-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {tpl.metaFields.map((f) => renderMeta(f))}
      </section>

      {tpl.mode === "scored" ? (
        <section className="card-elevated p-6 space-y-4">
          <h2 className="font-semibold text-lg">{t("moderation.new")}</h2>
          {scoredItems.map((it) => (
            <div key={it.key} className="grid gap-2 md:grid-cols-[1fr_120px] items-start border-b border-border pb-3 last:border-b-0">
              <div>
                <div className="font-medium">{t(it.labelKey)}</div>
                <textarea
                  placeholder={t("moderation.comment")}
                  value={scores[it.key]?.comment ?? ""}
                  onChange={(e) => setScores({ ...scores, [it.key]: { ...scores[it.key], comment: e.target.value } })}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("moderation.score")} (/{it.maxScore})</label>
                <input
                  type="number"
                  min={0}
                  max={it.maxScore}
                  step={0.5}
                  value={scores[it.key]?.score ?? 0}
                  onChange={(e) => setScores({ ...scores, [it.key]: { ...scores[it.key], score: Math.min(it.maxScore, Math.max(0, Number(e.target.value))) } })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="card-elevated p-6 space-y-6">
          <h2 className="font-semibold text-lg">{t("moderation.checklist")}</h2>
          {tpl.sections.map((sec) => (
            <div key={sec.key} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">{t(sec.titleKey)}</h3>
              {sec.items.map((it) => (
                <div key={it.key} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0">
                  <div className="flex-1 min-w-[240px] text-sm">{t(it.labelKey)}</div>
                  <AnswerToggle
                    value={answers[it.key]}
                    allowNa={it.allowNa}
                    onChange={(v) => setAnswers({ ...answers, [it.key]: v })}
                    labels={{ yes: t("answer.yes"), no: t("answer.no"), na: t("answer.na") }}
                  />
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      <section className="card-elevated p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">{tpl.mode === "checklist" ? t("moderation.comments") : t("moderation.generalComments")}</span>
          <textarea
            value={state.general_comments}
            onChange={(e) => setState({ ...state, general_comments: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
          />
        </label>
        {tpl.mode === "scored" && (
          <label className="block">
            <span className="text-sm font-medium">{t("moderation.recommendations")}</span>
            <textarea
              value={state.recommendations}
              onChange={(e) => setState({ ...state, recommendations: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
            />
          </label>
        )}
      </section>

      <div className="card-elevated p-6 flex items-center justify-between">
        {tpl.mode === "scored" ? (
          <div className="text-sm">
            <div className="text-muted-foreground">
              {t("moderation.total")}: <span className="font-semibold text-foreground">{total} / {totalMax}</span>
            </div>
            <div className="text-2xl font-bold">{percentage.toFixed(1)}%</div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            {checklist.filter((it) => answers[it.key]).length} / {checklist.length} answered
          </div>
        )}
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

function AnswerToggle({
  value,
  allowNa,
  onChange,
  labels,
}: {
  value: ChecklistAnswer | undefined;
  allowNa?: boolean;
  onChange: (v: ChecklistAnswer) => void;
  labels: { yes: string; no: string; na: string };
}) {
  const opts: { key: ChecklistAnswer; label: string; active: string }[] = [
    { key: "yes", label: labels.yes, active: "bg-status-green text-white border-status-green" },
    { key: "no", label: labels.no, active: "bg-status-red text-white border-status-red" },
    ...(allowNa ? [{ key: "na" as ChecklistAnswer, label: labels.na, active: "bg-muted-foreground text-white border-muted-foreground" }] : []),
  ];
  return (
    <div className="flex gap-1">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${value === o.key ? o.active : "border-input bg-background hover:bg-accent"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </label>
  );
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </label>
  );
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="">—</option>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </label>
  );
}
