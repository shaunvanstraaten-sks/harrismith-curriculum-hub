import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

type ModType = Database["public"]["Enums"]["moderation_type"];

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
  head: () => ({
    meta: [{ title: "History — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

const EMPTY = {
  type: "",
  quarter: "",
  grade_id: "",
  subject_id: "",
  teacher_id: "",
  status: "",
  from: "",
  to: "",
};

function HistoryPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const isStaff = hasAnyRole(roles, ["administrator", "principal", "hod", "head_of_subject"]);
  const [f, setF] = useState({ ...EMPTY });

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
    enabled: isStaff,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").order("full_name")).data ?? [],
  });

  // RLS scopes this automatically: teachers see only their own rows,
  // administrators / principals / HODs / heads of subject see all.
  const { data, isLoading } = useQuery({
    queryKey: ["history", f],
    queryFn: async () => {
      let q = supabase
        .from("moderation_submissions")
        .select(
          "id, moderation_type, moderation_date, academic_year, quarter, percentage, status, total_score, max_score, grades(name), subjects(name), teacher:profiles!moderation_submissions_teacher_id_fkey(full_name, email)",
        )
        .order("moderation_date", { ascending: false });

      if (f.type) q = q.eq("moderation_type", f.type as ModType);
      if (f.quarter) q = q.eq("quarter", Number(f.quarter));
      if (f.grade_id) q = q.eq("grade_id", f.grade_id);
      if (f.subject_id) q = q.eq("subject_id", f.subject_id);
      if (f.teacher_id) q = q.eq("teacher_id", f.teacher_id);
      if (f.status) q = q.eq("status", f.status as "draft" | "submitted");
      if (f.from) q = q.gte("moderation_date", f.from);
      if (f.to) q = q.lte("moderation_date", f.to);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = data ?? [];
  const active = Object.values(f).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-muted-foreground">{t("nav.history")}</div>
          <h1 className="text-3xl font-bold">{t("history.title")}</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          {rows.length} {t("history.results")}
        </div>
      </div>

      <section className="card-elevated p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("history.type")}>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inputCls}>
            <option value="">{t("history.all")}</option>
            <option value="pre_moderation">{t("dashboard.preModeration")}</option>
            <option value="post_moderation">{t("dashboard.postModeration")}</option>
            <option value="book_control">{t("dashboard.bookControl")}</option>
          </select>
        </Field>

        <Field label={t("moderation.term")}>
          <select value={f.quarter} onChange={(e) => setF({ ...f, quarter: e.target.value })} className={inputCls}>
            <option value="">{t("history.all")}</option>
            {["1", "2", "3", "4"].map((q) => (
              <option key={q} value={q}>
                {t("moderation.term")} {q}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("moderation.grade")}>
          <select value={f.grade_id} onChange={(e) => setF({ ...f, grade_id: e.target.value })} className={inputCls}>
            <option value="">{t("history.all")}</option>
            {(grades ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("moderation.subject")}>
          <select value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })} className={inputCls}>
            <option value="">{t("history.all")}</option>
            {(subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        {isStaff && (
          <Field label={t("moderation.teacher")}>
            <select value={f.teacher_id} onChange={(e) => setF({ ...f, teacher_id: e.target.value })} className={inputCls}>
              <option value="">{t("history.all")}</option>
              {(teachers ?? []).map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.full_name || tp.email}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t("moderation.status")}>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inputCls}>
            <option value="">{t("history.all")}</option>
            <option value="submitted">{t("history.submitted")}</option>
            <option value="draft">{t("history.draft")}</option>
          </select>
        </Field>

        <Field label={t("history.from")}>
          <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={inputCls} />
        </Field>

        <Field label={t("history.to")}>
          <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={inputCls} />
        </Field>

        {active && (
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              onClick={() => setF({ ...EMPTY })}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t("history.clear")}
            </button>
          </div>
        )}
      </section>

      <div className="card-elevated overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">{t("history.empty")}</div>
        ) : (
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">{t("moderation.date")}</th>
                <th className="p-3">{t("history.type")}</th>
                <th className="p-3">{t("moderation.teacher")}</th>
                <th className="p-3">{t("moderation.grade")}</th>
                <th className="p-3">{t("moderation.subject")}</th>
                <th className="p-3">{t("moderation.term")}</th>
                <th className="p-3">%</th>
                <th className="p-3">{t("moderation.status")}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                // Pre-Moderation is a checklist with no percentage.
                const showPct = r.moderation_type !== "pre_moderation" && Number(r.max_score) > 0;
                const pct = Number(r.percentage);
                const color = pct >= 85 ? "bg-status-green" : pct >= 70 ? "bg-status-orange" : "bg-status-red";
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 whitespace-nowrap">{r.moderation_date}</td>
                    <td className="p-3">{t(typeLabelKey(r.moderation_type))}</td>
                    <td className="p-3">{r.teacher?.full_name || r.teacher?.email || "—"}</td>
                    <td className="p-3">{r.grades?.name ?? "—"}</td>
                    <td className="p-3">{r.subjects?.name ?? "—"}</td>
                    <td className="p-3">{r.quarter}</td>
                    <td className="p-3">
                      {showPct ? (
                        <span className={`inline-block rounded px-2 py-0.5 text-white text-xs ${color}`}>{pct.toFixed(1)}%</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 capitalize">{r.status === "submitted" ? t("history.submitted") : t("history.draft")}</td>
                    <td className="p-3 text-right">
                      <Link to="/moderation/view/$id" params={{ id: r.id }} className="text-primary hover:underline font-medium">
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

const inputCls = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function typeLabelKey(type: string) {
  if (type === "book_control") return "dashboard.bookControl";
  if (type === "post_moderation") return "dashboard.postModeration";
  return "dashboard.preModeration";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
