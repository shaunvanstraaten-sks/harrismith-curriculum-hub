import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole, type AppRole } from "@/hooks/use-auth";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
  head: () => ({
    meta: [{ title: "Users — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

const ROLE_OPTIONS: AppRole[] = ["administrator", "principal", "hod", "head_of_subject", "teacher"];
/** Roles that are meaningfully limited to a grade. Admin/Principal are school-wide. */
const SCOPABLE: AppRole[] = ["hod", "head_of_subject", "teacher"];

type Assignment = { role: AppRole; grade_id: string | null; subject_id: string | null };

function AdminUsers() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasAnyRole(roles, ["administrator"]);

  const { data: grades } = useQuery({
    queryKey: ["grades"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("grades").select("id, name").order("sort_order")).data ?? [],
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("subjects").select("id, name").order("name")).data ?? [],
  });

  const { data } = useQuery({
    queryKey: ["all-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: userRoles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, email, is_approved").order("full_name"),
        supabase.from("user_roles").select("user_id, role, grade_id, subject_id"),
      ]);
      const byUser: Record<string, Assignment[]> = {};
      (userRoles ?? []).forEach((r) => {
        byUser[r.user_id] = [
          ...(byUser[r.user_id] ?? []),
          { role: r.role as AppRole, grade_id: r.grade_id, subject_id: r.subject_id },
        ];
      });
      return (profiles ?? []).map((p) => ({ ...p, assignments: byUser[p.id] ?? [] }));
    },
  });

  if (!isAdmin) return <div className="text-muted-foreground">Access denied.</div>;

  const gradeName = (id: string | null) => (id ? (grades ?? []).find((g) => g.id === id)?.name ?? "?" : "All grades");
  const subjectName = (id: string | null) =>
    id ? (subjects ?? []).find((x) => x.id === id)?.name ?? "?" : "All subjects";

  const toggleApproved = async (id: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_approved: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(current ? "Revoked" : t("common.approved"));
      qc.invalidateQueries({ queryKey: ["all-users"] });
    }
  };

  const addRole = async (
    userId: string,
    role: AppRole,
    gradeId: string | null,
    subjectId: string | null,
  ) => {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role, grade_id: gradeId, subject_id: subjectId });
    if (error) toast.error(error.message);
    else {
      toast.success("Role added");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    }
  };

  const removeRole = async (
    userId: string,
    role: AppRole,
    gradeId: string | null,
    subjectId: string | null,
  ) => {
    let q = supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    q = gradeId === null ? q.is("grade_id", null) : q.eq("grade_id", gradeId);
    q = subjectId === null ? q.is("subject_id", null) : q.eq("subject_id", subjectId);
    const { error } = await q;
    if (error) toast.error(error.message);
    else {
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("nav.users")}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Approve new registrations and assign roles. A user can hold several roles, each limited by grade
          and/or subject — leave either as "All" for no limit. So a Head of Subject for Afrikaans across the
          whole school is <em>All grades · Afrikaans</em>, while a Grade 4 HOD over every subject is{" "}
          <em>Grade 4 · All subjects</em>. Administrator and Principal are always school-wide. Everyone keeps
          access to their own records regardless of the roles assigned.
        </p>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Roles</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border align-top">
                <td className="p-3 font-medium">{u.full_name || u.username || "—"}</td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {u.assignments.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                    {u.assignments.map((a) => (
                      <span
                        key={`${a.role}:${a.grade_id ?? "all"}:${a.subject_id ?? "all"}`}
                        className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2 py-0.5 text-xs font-medium"
                      >
                        {t(`roles.${a.role}`)}
                        <span className="text-muted-foreground">
                          · {gradeName(a.grade_id)} · {subjectName(a.subject_id)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeRole(u.id, a.role, a.grade_id, a.subject_id)}
                          className="ml-0.5 rounded hover:bg-destructive/20"
                          aria-label="Remove role"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <RoleAdder
                    grades={grades ?? []}
                    subjects={subjects ?? []}
                    onAdd={(role, gradeId, subjectId) => addRole(u.id, role, gradeId, subjectId)}
                    t={t}
                  />
                </td>
                <td className="p-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs text-white ${u.is_approved ? "bg-status-green" : "bg-status-orange"}`}
                  >
                    {u.is_approved ? t("common.approved") : t("common.pending")}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => toggleApproved(u.id, u.is_approved)}
                    className="rounded-md border border-input px-3 py-1 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    {u.is_approved ? "Revoke" : t("common.approve")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleAdder({
  grades,
  subjects,
  onAdd,
  t,
}: {
  grades: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  onAdd: (role: AppRole, gradeId: string | null, subjectId: string | null) => void;
  t: (k: string) => string;
}) {
  const [role, setRole] = useState<AppRole>("teacher");
  const [gradeId, setGradeId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const scopable = SCOPABLE.includes(role);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as AppRole)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {t(`roles.${r}`)}
          </option>
        ))}
      </select>
      <select
        value={scopable ? gradeId : ""}
        disabled={!scopable}
        onChange={(e) => setGradeId(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
        title={scopable ? "Limit this role to a grade" : "Administrator and Principal are school-wide"}
      >
        <option value="">All grades</option>
        {grades.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <select
        value={scopable ? subjectId : ""}
        disabled={!scopable}
        onChange={(e) => setSubjectId(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
        title={scopable ? "Limit this role to a subject" : "Administrator and Principal are school-wide"}
      >
        <option value="">All subjects</option>
        {subjects.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() =>
          onAdd(role, scopable && gradeId ? gradeId : null, scopable && subjectId ? subjectId : null)
        }
        className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
      >
        + Add
      </button>
    </div>
  );
}
