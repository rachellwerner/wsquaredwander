import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { canonicalUrl } from "@/lib/site";

export const Route = createFileRoute("/set-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set your password — W²ander" },
      {
        name: "description",
        content:
          "Choose a password for your W²ander account after accepting an invitation or requesting a reset link.",
      },
      { property: "og:title", content: "Set your password — W²ander" },
      { property: "og:description", content: "Choose a password for your W²ander account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: canonicalUrl("/set-password") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/set-password") }],
  }),
  component: SetPasswordPage,
});

type LinkState = "checking" | "ready" | "expired" | "missing";

/** Error Supabase puts in the URL when an invite/reset link is expired or already used. */
function linkError(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return (
    params.get("error_description") ??
    params.get("error_code") ??
    query.get("error_description") ??
    query.get("error_code") ??
    null
  );
}

function SetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<LinkState>("checking");

  // The invite/reset link signs the person in through the URL; wait for that before showing the form.
  useEffect(() => {
    if (linkError()) {
      setState("expired");
      return;
    }
    let done = false;
    const finish = (s: LinkState) => {
      if (!done) {
        done = true;
        setState(s);
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish("ready");
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish("ready");
      else setTimeout(() => finish("missing"), 1500);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (/session/i.test(error.message)) {
          setState("expired");
          return;
        }
        throw error;
      }
      toast.success("Password set. Welcome to W²ander!");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "That link may have expired — ask for a new invitation.",
      );
    } finally {
      setBusy(false);
    }
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

        {state === "checking" && (
          <div className="rounded-2xl border bg-card p-7 text-center text-sm text-muted-foreground shadow-sm">
            Checking your link…
          </div>
        )}

        {(state === "expired" || state === "missing") && (
          <div className="rounded-2xl border bg-card p-7 shadow-sm">
            <h1 className="font-serif text-2xl font-medium">
              {state === "expired" ? "This link has expired" : "Open the link from your email"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {state === "expired"
                ? "Invite and password links can only be used once and expire after a day. Ask Rachel to send you a new invitation, then open the newest email."
                : "To set your password, open the invitation or password link from your email on this device."}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Already set a password?{" "}
              <Link to="/auth" className="font-medium text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}

        <div className={`rounded-2xl border bg-card p-7 shadow-sm ${state === "ready" ? "" : "hidden"}`}>
          <h1 className="font-serif text-2xl font-medium">Set your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a password and you’re in.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Save password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
