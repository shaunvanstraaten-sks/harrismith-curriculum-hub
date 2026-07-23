import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole, type AppRole } from "@/hooks/use-auth";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogOut, LayoutDashboard, ClipboardCheck, FileText, Users } from "lucide-react";

interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactNode;
  roles?: AppRole[];
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, roles, fullName, isApproved, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const navItems: NavItem[] = [
    { to: "/dashboard", labelKey: "nav.dashboard", icon: <LayoutDashboard size={18} /> },
    { to: "/moderation", labelKey: "nav.moderation", icon: <ClipboardCheck size={18} /> },
    { to: "/reports", labelKey: "nav.reports", icon: <FileText size={18} /> },
    {
      to: "/admin/users",
      labelKey: "nav.users",
      icon: <Users size={18} />,
      roles: ["administrator"],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header banner */}
      <header className="brand-gradient text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img
              src="/hps-logo.jpg"
              alt="Harrismith Primary School crest"
              className="h-12 w-12 rounded bg-white p-1 shadow"
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide uppercase text-white/80">
                {t("app.name")}
              </div>
              <div className="text-lg font-semibold">{t("app.subtitle")}</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="hidden sm:block text-sm text-white/80">{fullName || user?.email}</div>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm"
            >
              <LogOut size={16} /> {t("nav.signOut")}
            </button>
          </div>
        </div>
        {/* Sub-nav */}
        <nav className="border-t border-white/10 bg-black/10">
          <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {navItems
              .filter((i) => !i.roles || hasAnyRole(roles, i.roles))
              .map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm border-b-2 transition-colors ${
                      active
                        ? "border-accent text-white"
                        : "border-transparent text-white/70 hover:text-white"
                    }`}
                  >
                    {item.icon}
                    {t(item.labelKey)}
                  </Link>
                );
              })}
          </div>
        </nav>
      </header>

      {!isApproved && (
        <div className="bg-status-orange/15 border-b border-status-orange/30 text-foreground text-sm px-4 py-2 text-center">
          {t("auth.pendingApproval")}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Harrismith Primary School</span>
          <span className="italic">{t("app.tagline")}</span>
        </div>
      </footer>
    </div>
  );
}
