import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { canonicalUrl } from "@/lib/site";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — W²ander trip planner" },
      { name: "description", content: "Sign in to W²ander (read “Wander Squared”) to sync your family trips across devices and forward confirmation emails straight into your itinerary." },
      { property: "og:title", content: "Sign in — W²ander trip planner" },
      { property: "og:description", content: "Sync your family trips and forward confirmations into your itinerary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: canonicalUrl("/auth") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/auth") }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) navigate({ to: "/" });
  }, [ready, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your email for a link to set a new password.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Compass className="h-5 w-5" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">W²ander</span>
        </Link>

        <div className="rounded-2xl border bg-card p-7 shadow-sm">
          <h1 className="font-serif text-2xl font-medium">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            W²ander is invite only. Sign in with the email your invitation was sent to.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Sign in
            </Button>
          </form>

          <button
            type="button"
            className="mt-5 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={forgot}
          >
            Forgot your password?
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Need access? Ask the trip admin to invite you.
          </p>
        </div>
      </div>
    </div>
  );
}