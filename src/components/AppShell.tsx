import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Compass, Inbox, LogOut, Luggage, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useIsAdmin } from "@/lib/use-members";

function usePendingCount() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: ["pending-count", user?.id ?? null],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("parsed_bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

type NavItem = { to: "/" | "/today" | "/users" | "/inbox"; label: string; icon: typeof Compass; badge?: number };

/** Top bar on all screens + a thumb-friendly tab bar on phones. */
export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const pending = usePendingCount().data ?? 0;
  const path = useRouterState({ select: (s) => s.location.pathname });

  const items: NavItem[] = [
    { to: "/", label: "Trips", icon: Luggage },
    { to: "/today", label: "Today", icon: CalendarCheck },
    ...(isAdmin
      ? ([
          { to: "/users", label: "People", icon: Users },
          { to: "/inbox", label: "Inbox", icon: Inbox, badge: pending },
        ] as NavItem[])
      : []),
  ];
  const active = (to: string) => (to === "/" ? path === "/" || path.startsWith("/trip") : path.startsWith(to));

  return (
    <div className="min-h-screen bg-paper bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 ${wide ? "max-w-5xl" : "max-w-4xl"}`}>
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:h-9 sm:w-9">
              <Compass className="h-5 w-5" />
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight sm:text-xl">W²ander</span>
          </Link>
          {user ? (
            <nav className="flex items-center gap-1">
              <div className="hidden items-center gap-1 sm:flex">
                {items.map((it) => (
                  <Link key={it.to} to={it.to}>
                    <Button variant={active(it.to) ? "secondary" : "ghost"} size="sm">
                      <it.icon className="mr-1.5 h-4 w-4" /> {it.label}
                      {!!it.badge && (
                        <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                          {it.badge}
                        </span>
                      )}
                    </Button>
                  </Link>
                ))}
              </div>
              <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => supabase.auth.signOut()}>
                <LogOut className="h-4 w-4" />
              </Button>
            </nav>
          ) : (
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </header>

      {children}

      {user && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-md">
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                  active(it.to) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <it.icon className="h-5 w-5" />
                {it.label}
                {!!it.badge && (
                  <span className="absolute right-[calc(50%-1.25rem)] top-1.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-foreground">
                    {it.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
