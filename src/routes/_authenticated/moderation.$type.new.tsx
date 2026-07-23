import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { itemsFor } from "@/lib/moderation-templates";
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
    meta: [
      { title: "New moderation — Harrismith Primary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function NewModeration() {
  const { t } = useTranslation();
  const { type } = useParams({ from: "/_authenticated/moderation/$type/new" });
  const cfg = TYPE_MAP[type];
  const navigate = useNavigate();
  const { user } = useAuth();
  const items = useMemo(() => (cfg ? itemsFor(cfg.db) : []), [cfg]);

  const [state, setState] = useState({
    academic_year: new Date().getFullYear(),
    quarter: 1,
    cycle: 1,
    weeks: "1-2",
    moderation_date: new Date().toISOString().slice(0, 10),
    teacher_id: "",
    subject_id: "",
    grade_id: "",
    general_comments: "",
    recommendations: "",
  });

  const [scores, setScores] = useState<Record<string, { score: number; comment: string }>>(() =>
    Object.fromEntries(items.map((i) => [i.key, { score: 0, comment: "" }])),
  );

  const { data: grades } = useQuery({
    queryKey: ["grades"],
    queryFn: async () =>
      (await supabase.from("grades").select("id, name").order("sort_order")).data ?? [],
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () =>
      (await supabase.from("subjects").select("id, name").order("name")).data ?? [],
  });
  const { data: teachers } = useQuery({
    queryKey: ["teacher-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      return data ?? [];
    },
  });

  const totalMax = items.reduce((a, b) => a + b.maxScore, 0);
  const total = items.reduce((a, b) => a + (scores[b.key]?.score ?? 0), 0);
  const percentage = totalMax ? (total / totalMax) * 100 : 0;

  const save = async (submit: boolean) => {
    if (!cfg || !user) return;
    if (!state.teacher_id || !state.subject_id || !state.grade_id) {
      toast.error("Please select teacher, subject and grade.");
      return;
    }
    const payload = {
      moderation_type: cfg.db,
      academic_year: Number(state.academic_year),
      quarter: Number(state.quarter),
      cycle: Number(state.cycle),
      weeks: state.weeks,
      moderation_date: state.moderation_date,
      teacher_id: state.teacher_id,
      head_of_subject_id: user.id,
      subject_id: state.subject_id,
      grade_id: state.grade_id,
      total_score: total,
      max_score: totalMax,
      percentage,
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
    const rows = items.map((it, idx) => ({
      submission_id: sub.id,
      item_key: it.key,
      item_label: t(it.labelKey),
      score: scores[it.key]?.score ?? 0,
      max_score: it.maxScore,
      comment: scores[it.key]?.comment ?? "",
      sort_order: idx,
    }));
    const { error: sErr } = await supabase.from("moderation_scores").insert(rows);
    if (sErr) {
      toast.error(sErr.message);
      return;
    }
    toast.success(submit ? "Submitted" : "Saved as draft");
    navigate({ to: "/moderation/view/$id", params: { id: sub.id } });
  };

  if (!cfg) return <div>Unknown type</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="text-sm text-muted-foreground">{t(cfg.labelKey)}</div>
        <h1 className="text-3xl font-bold">{t("moderation.new")}</h1>
      </div>

      <section className="card-elevated p-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <NumberField
          label={t("moderation.academicYear")}
          value={state.academic_year}
          onChange={(v) => setState({ ...state, academic_year: v })}
        />
        <SelectField
          label={t("moderation.quarter")}
          value={String(state.quarter)}
          options={["1", "2", "3", "4"]}
          onChange={(v) => setState({ ...state, quarter: Number(v) })}
        />
        <SelectField
          label={t("moderation.cycle")}
          value={String(state.cycle)}
          options={["1", "2", "3", "4"]}
          onChange={(v) => setState({ ...state, cycle: Number(v) })}
        />
        <TextField
          label={t("moderation.weeks")}
          value={state.weeks}
          onChange={(v) => setState({ ...state, weeks: v })}
        />
        <DateField
          label={t("moderation.date")}
          value={state.moderation_date}
          onChange={(v) => setState({ ...state, moderation_date: v })}
        />
        <SelectField
          label={t("moderation.grade")}
          value={state.grade_id}
          options={(grades ?? []).map((g) => ({ value: g.id, label: g.name }))}
          onChange={(v) => setState({ ...state, grade_id: v })}
        />
        <SelectField
          label={t("moderation.subject")}
          value={state.subject_id}
          options={(subjects ?? []).map((s) => ({ value: s.id, label: s.name }))}
          onChange={(v) => setState({ ...state, subject_id: v })}
        />
        <SelectField
          label={t("moderation.teacher")}
          value={state.teacher_id}
          options={(teachers ?? []).map((tp) => ({
            value: tp.id,
            label: tp.full_name || tp.email || "—",
          }))}
          onChange={(v) => setState({ ...state, teacher_id: v })}
        />
      </section>

      <section className="card-elevated p-6 space-y-4">
        <h2 className="font-semibold text-lg">Moderation checklist</h2>
        {items.map((it) => (
          <div
            key={it.key}
            className="grid gap-2 md:grid-cols-[1fr_120px] items-start border-b border-border pb-3 last:border-b-0"
          >
            <div>
              <div className="font-medium">{t(it.labelKey)}</div>
              <textarea
                placeholder={t("moderation.comment")}
                value={scores[it.key]?.comment ?? ""}
                onChange={(e) =>
                  setScores({ ...scores, [it.key]: { ...scores[it.key], comment: e.target.value } })
                }
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                {t("moderation.score")} (/{it.maxScore})
              </label>
              <input
                type="number"
                min={0}
                max={it.maxScore}
                step={0.5}
                value={scores[it.key]?.score ?? 0}
                onChange={(e) =>
                  setScores({
                    ...scores,
                    [it.key]: {
                      ...scores[it.key],
                      score: Math.min(it.maxScore, Math.max(0, Number(e.target.value))),
                    },
                  })
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        ))}
      </section>

      <section className="card-elevated p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">{t("moderation.generalComments")}</span>
          <textarea
            value={state.general_comments}
            onChange={(e) => setState({ ...state, general_comments: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t("moderation.recommendations")}</span>
          <textarea
            value={state.recommendations}
            onChange={(e) => setState({ ...state, recommendations: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
          />
        </label>
      </section>

      <div className="card-elevated p-6 flex items-center justify-between">
        <div className="text-sm">
          <div className="text-muted-foreground">
            {t("moderation.total")}:{" "}
            <span className="font-semibold text-foreground">
              {total} / {totalMax}
            </span>
          </div>
          <div className="text-2xl font-bold">{percentage.toFixed(1)}%</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => save(false)}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            {t("moderation.saveDraft")}
          </button>
          <button
            onClick={() => save(true)}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:brightness-110"
          >
            {t("moderation.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
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
