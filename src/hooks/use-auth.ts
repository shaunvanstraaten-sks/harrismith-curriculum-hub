import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "administrator" | "principal" | "hod" | "head_of_subject" | "teacher";

export interface AuthState {
  user: User | null;
  loading: boolean;
  roles: AppRole[];
  isApproved: boolean;
  fullName: string | null;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async (u: User | null) => {
      if (!u) {
        setRoles([]);
        setIsApproved(false);
        setFullName(null);
        return;
      }
      const [{ data: rs }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.id),
        supabase.from("profiles").select("is_approved, full_name").eq("id", u.id).maybeSingle(),
      ]);
      if (!mounted) return;
      setRoles((rs ?? []).map((r) => r.role as AppRole));
      setIsApproved(!!p?.is_approved);
      setFullName(p?.full_name ?? null);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      load(data.session?.user ?? null).finally(() => mounted && setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      // Defer async work
      setTimeout(() => load(session?.user ?? null), 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, roles, isApproved, fullName };
}

export function hasAnyRole(roles: AppRole[], allowed: AppRole[]) {
  return roles.some((r) => allowed.includes(r));
}
