import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole, type AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
  head: () => ({
    meta: [{ title: "Users — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

const ROLE_OPTIONS: AppRole[] = ["administrator", "principal", "hod", "head_of_subject", "teacher"];

function AdminUsers() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasAnyRole(roles, ["administrator"]);

  const { data } = useQuery({
    queryKey: ["all-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: userRoles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, email, is_approved").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser: Record<string, AppRole[]> = {};
      (userRoles ?? []).forEach((r) => {
        rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] ?? []), r.role as AppRole];
      });
      return (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser[p.id] ?? [] }));
    },
  });

  if (!isAdmin) return <div className="text-muted-foreground">Access denied.</div>;

  const toggleApproved = async (id: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_approved: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(current ? "Revoked" : t("common.approved"));
      qc.invalidateQueries({ queryKey: ["all-users"] });
    }
  };

  // Roles are additive: a user may hold several (e.g. HOD *and* Head of Subject).
  // Note that "teacher" access is identity-based (teacher_id = auth.uid()), so
  // every user keeps their own dashboard/history regardless of which roles they hold.
  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    const { error } = has
      ? await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Roles updated");
    qc.invalidateQueries({ queryKey: ["all-users"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("nav.users")}</h1>
        <p className="text-sm text-muted-foreground">
          Approve new registrations and assign roles. Click a role to add or remove it — a user can hold
          several (e.g. HOD and Head of Subject). Everyone keeps teacher-level access to their own records
          regardless of the roles assigned.
        </p>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">{t("common.role")}</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3 font-medium">{u.full_name || u.username || "—"}</td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {ROLE_OPTIONS.map((r) => {
                      const has = u.roles.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => toggleRole(u.id, r, has)}
                          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition ${
                            has
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-input bg-background text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {t(`roles.${r}`)}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs text-white ${
                      u.is_approved ? "bg-status-green" : "bg-status-orange"
                    }`}
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
