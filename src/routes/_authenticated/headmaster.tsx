import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/use-auth";
import { typeLabelKey } from "@/lib/moderation-templates";
import type { Database } from "@/integrations/supabase/types";
import { AlertCircle, CalendarClock, ArrowLeft } from "lucide-react";

type ModType = Database["public"]["Enums"]["moderation_type"];

const ALL_TYPES: ModType[] = [
  "pre_moderation",
  "post_moderation",
  "book_control",
  "analysis_of_results",
  "subject_improvement_plan",
];
const HOS_TYPES: ModType[] = ["pre_moderation", "post_moderation", "book_control"];
const GRADE_NAME_RE = /^Grade [4-7]$/;
const ATTENTION_THRESHOLD = 85;

function currentQuarter(): number {
  const m = new Date().getMonth();
  if (m <= 2) return 1;
  if (m <= 5) return 2;
  if (m <= 8) return 3;
  return 4;
}

export const Route = createFileRoute("/_authenticated/headmaster")({
  component: HeadmasterPage,
  head: () => ({
    meta: [
      { title: "Headmaster Dashboard — Harrismith Primary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

interface MissedSlot {
  gradeId: string | null;
  subjectId: string | null;
  userId: string;
}

function HeadmasterPage() {
  const { t } = useTranslation();
  const { user, roles } = useAuth();
  const isPrincipal = hasAnyRole(roles, ["principal"]);
  const qc = useQueryClient();

  const [gradeFilter, setGradeFilter] = useState("");
  const [academicYear, setAcademicYear] = useState(() => new Date().getFullYear());
  const [quarter, setQuarter] = useState(() => currentQuarter());
  const [topPanel, setTopPanel] = useState<"attention" | "deadlines" | null>(null);
  const [selectedType, setSelectedType] = useState<ModType | null>(null);
  const [dueDateDrafts, setDueDateDrafts] = useState<Record<string, string>>({});

  const { data: grades } = useQuery({
    queryKey: ["grades"],
    enabled: isPrincipal,
    queryFn: async () =>
      (await supabase.from("grades").select("id, name").order("sort_order")).data ?? [],
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    enabled: isPrincipal,
    queryFn: async () =>
      (await supabase.from("subjects").select("id, name").order("name")).data ?? [],
  });
  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    enabled: isPrincipal,
    queryFn: async () =>
      (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
  });
  const { data: roleRows } = useQuery({
    queryKey: ["deadline-assignments"],
    enabled: isPrincipal,
    queryFn: async () =>
      (
        await supabase
          .from("user_roles")
          .select("user_id, role, grade_id, subject_id")
          .in("role", ["head_of_subject", "teacher"])
          .not("grade_id", "is", null)
          .not("subject_id", "is", null)
      ).data ?? [],
  });
  const { data: bookControlSubmitted } = useQuery({
    queryKey: ["headmaster-book-control", academicYear],
    enabled: isPrincipal,
    queryFn: async () =>
      (
        await supabase
          .from("moderation_submissions")
          .select("id, percentage, grade_id, subject_id, teacher_id")
          .eq("moderation_type", "book_control")
          .eq("status", "submitted")
          .eq("academic_year", academicYear)
      ).data ?? [],
  });
  const { data: termSubmissions } = useQuery({
    queryKey: ["headmaster-term-submissions", academicYear, quarter],
    enabled: isPrincipal,
    queryFn: async () =>
      (
        await supabase
          .from("moderation_submissions")
          .select("moderation_type, grade_id, subject_id, teacher_id, head_of_subject_id")
          .eq("status", "submitted")
          .eq("academic_year", academicYear)
          .eq("quarter", quarter)
      ).data ?? [],
  });
  const { data: deadlines } = useQuery({
    queryKey: ["moderation-deadlines", academicYear, quarter],
    enabled: isPrincipal,
    queryFn: async () =>
      (
        await supabase
          .from("moderation_deadlines")
          .select("id, moderation_type, due_date")
          .eq("academic_year", academicYear)
          .eq("quarter", quarter)
      ).data ?? [],
  });

  const gradeOptions = (grades ?? []).filter((g) => GRADE_NAME_RE.test(g.name));
  const gradeMap = useMemo(() => new Map((grades ?? []).map((g) => [g.id, g.name])), [grades]);
  const subjectMap = useMemo(
    () => new Map((subjects ?? []).map((s) => [s.id, s.name])),
    [subjects],
  );
  const profileMap = useMemo(
    () => new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || "—"])),
    [profiles],
  );

  const attentionList = (bookControlSubmitted ?? []).filter(
    (s) =>
      Number(s.percentage) < ATTENTION_THRESHOLD && (!gradeFilter || s.grade_id === gradeFilter),
  );

  const missedByType = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const result: Partial<Record<ModType, MissedSlot[]>> = {};
    ALL_TYPES.forEach((type) => {
      const deadline = (deadlines ?? []).find((d) => d.moderation_type === type);
      if (!deadline || deadline.due_date >= today) return;
      const isHos = HOS_TYPES.includes(type);
      const slots = (roleRows ?? []).filter(
        (r) => r.role === (isHos ? "head_of_subject" : "teacher"),
      );
      const missed: MissedSlot[] = [];
      slots.forEach((slot) => {
        if (gradeFilter && slot.grade_id !== gradeFilter) return;
        const matched = (termSubmissions ?? []).some(
          (s) =>
            s.moderation_type === type &&
            s.grade_id === slot.grade_id &&
            s.subject_id === slot.subject_id &&
            (isHos ? s.head_of_subject_id === slot.user_id : s.teacher_id === slot.user_id),
        );
        if (!matched)
          missed.push({ gradeId: slot.grade_id, subjectId: slot.subject_id, userId: slot.user_id });
      });
      if (missed.length) result[type] = missed;
    });
    return result;
  }, [deadlines, roleRows, termSubmissions, gradeFilter]);

  const totalMissed = Object.values(missedByType).reduce((a, b) => a + (b?.length ?? 0), 0);

  const openPanel = (panel: "attention" | "deadlines") => {
    setTopPanel(topPanel === panel ? null : panel);
    setSelectedType(null);
  };

  const saveDeadline = async (type: ModType, dueDate: string) => {
    if (!dueDate || !user) return;
    const { error } = await supabase.from("moderation_deadlines").upsert(
      {
        moderation_type: type,
        academic_year: academicYear,
        quarter,
        due_date: dueDate,
        created_by: user.id,
      },
      { onConflict: "moderation_type,academic_year,quarter" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("headmaster.deadlineSaved"));
    qc.invalidateQueries({ queryKey: ["moderation-deadlines", academicYear, quarter] });
  };

  if (!isPrincipal) return <div className="text-muted-foreground">Access denied.</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-muted-foreground">{t("nav.headmaster")}</div>
        <h1 className="text-3xl font-bold">{t("headmaster.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("headmaster.subtitle")}</p>
      </div>

      {/* Grade filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setGradeFilter("")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
            gradeFilter === ""
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-accent border-input"
          }`}
        >
          {t("headmaster.allGrades")}
        </button>
        {gradeOptions.map((g) => (
          <button
            key={g.id}
            onClick={() => setGradeFilter(g.id)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
              gradeFilter === g.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent border-input"
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button onClick={() => openPanel("attention")} className="text-left">
          <div
            className={`card-elevated p-5 border-2 transition ${
              topPanel === "attention"
                ? "border-status-red"
                : "border-status-red/30 hover:border-status-red/60"
            }`}
          >
            <div className="flex items-center justify-between text-sm text-status-red">
              <span className="font-medium">{t("headmaster.attentionRequired")}</span>
              <AlertCircle size={20} />
            </div>
            <div className="mt-2 text-3xl font-bold">{attentionList.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("headmaster.attentionRequiredHint", { pct: ATTENTION_THRESHOLD })}
            </div>
          </div>
        </button>

        <button onClick={() => openPanel("deadlines")} className="text-left">
          <div
            className={`card-elevated p-5 border-2 transition ${
              topPanel === "deadlines"
                ? "border-status-red"
                : "border-status-red/30 hover:border-status-red/60"
            }`}
          >
            <div className="flex items-center justify-between text-sm text-status-red">
              <span className="font-medium">{t("headmaster.deadlinesMissed")}</span>
              <CalendarClock size={20} />
            </div>
            <div className="mt-2 text-3xl font-bold">{totalMissed}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("headmaster.deadlinesMissedHint")}
            </div>
          </div>
        </button>
      </div>

      {/* Drill-down: Attention Required */}
      {topPanel === "attention" && (
        <section className="card-elevated p-5 space-y-4">
          {selectedType === null ? (
            <TypeBreakdown
              rows={[{ type: "book_control" as ModType, count: attentionList.length }]}
              label={t("headmaster.byType")}
              t={t}
              onSelect={setSelectedType}
            />
          ) : (
            <div className="space-y-3">
              <BackButton t={t} onClick={() => setSelectedType(null)} />
              {attentionList.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("headmaster.noRecords")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-2">{t("moderation.teacher")}</th>
                        <th className="p-2">{t("moderation.grade")}</th>
                        <th className="p-2">{t("moderation.subject")}</th>
                        <th className="p-2">%</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {attentionList
                        .sort((a, b) => Number(a.percentage) - Number(b.percentage))
                        .map((row) => (
                          <tr key={row.id} className="border-t border-border">
                            <td className="p-2">{profileMap.get(row.teacher_id) ?? "—"}</td>
                            <td className="p-2">{gradeMap.get(row.grade_id ?? "") ?? "—"}</td>
                            <td className="p-2">{subjectMap.get(row.subject_id ?? "") ?? "—"}</td>
                            <td className="p-2">
                              <span className="inline-block rounded px-2 py-0.5 text-white text-xs bg-status-red">
                                {Number(row.percentage).toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-2 text-right">
                              <Link
                                to="/moderation/view/$id"
                                params={{ id: row.id }}
                                className="text-primary hover:underline font-medium"
                              >
                                {t("common.view")}
                              </Link>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Drill-down: Deadlines Missed */}
      {topPanel === "deadlines" && (
        <section className="card-elevated p-5 space-y-4">
          {selectedType === null ? (
            <TypeBreakdown
              rows={ALL_TYPES.filter((type) => missedByType[type]?.length).map((type) => ({
                type,
                count: missedByType[type]?.length ?? 0,
              }))}
              label={t("headmaster.byType")}
              t={t}
              onSelect={setSelectedType}
              emptyLabel={t("headmaster.noRecords")}
            />
          ) : (
            <div className="space-y-3">
              <BackButton t={t} onClick={() => setSelectedType(null)} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">{t("headmaster.responsible")}</th>
                      <th className="p-2">{t("moderation.grade")}</th>
                      <th className="p-2">{t("moderation.subject")}</th>
                      <th className="p-2">{t("moderation.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(missedByType[selectedType] ?? []).map((slot, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2">{profileMap.get(slot.userId) ?? "—"}</td>
                        <td className="p-2">{gradeMap.get(slot.gradeId ?? "") ?? "—"}</td>
                        <td className="p-2">{subjectMap.get(slot.subjectId ?? "") ?? "—"}</td>
                        <td className="p-2">
                          <span className="inline-block rounded px-2 py-0.5 text-white text-xs bg-status-red">
                            {t("headmaster.notSubmitted")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Term deadlines panel */}
      <section className="card-elevated p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t("headmaster.deadlinesPanelTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("headmaster.deadlinesPanelDesc")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            {t("headmaster.year")}
            <input
              type="number"
              value={academicYear}
              onChange={(e) => setAcademicYear(Number(e.target.value))}
              className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((q) => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                  quarter === q
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-input"
                }`}
              >
                {t("moderation.term")} {q}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">{t("history.type")}</th>
                <th className="p-2">{t("headmaster.dueDate")}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {ALL_TYPES.map((type) => {
                const existing = (deadlines ?? []).find((d) => d.moderation_type === type);
                const draftKey = type;
                const value = dueDateDrafts[draftKey] ?? existing?.due_date ?? "";
                return (
                  <tr key={type} className="border-t border-border">
                    <td className="p-2">{t(typeLabelKey(type))}</td>
                    <td className="p-2">
                      <input
                        type="date"
                        value={value}
                        onChange={(e) =>
                          setDueDateDrafts({ ...dueDateDrafts, [draftKey]: e.target.value })
                        }
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => saveDeadline(type, value)}
                        disabled={!value}
                        className="rounded-md border border-input px-3 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                      >
                        {t("common.save")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TypeBreakdown({
  rows,
  label,
  t,
  onSelect,
  emptyLabel,
}: {
  rows: { type: ModType; count: number }[];
  label: string;
  t: (k: string, opts?: any) => string;
  onSelect: (type: ModType) => void;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground">{emptyLabel ?? label}</div>;
  }
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <button
            key={r.type}
            onClick={() => onSelect(r.type)}
            className="rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent hover:border-primary transition"
          >
            {t(typeLabelKey(r.type))} <span className="ml-1 font-bold">{r.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BackButton({ t, onClick }: { t: (k: string) => string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <ArrowLeft size={14} /> {t("headmaster.backToOverview")}
    </button>
  );
}
