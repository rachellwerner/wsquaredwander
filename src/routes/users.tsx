import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Mail, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useIsAdmin, useMembers } from "@/lib/use-members";
import { firstName, formatBirthday, roleLabel, type Member, type MemberRole } from "@/lib/members";
import { inviteMember } from "@/lib/members.functions";
import { canonicalUrl } from "@/lib/site";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "People — W²ander trip planner" },
      {
        name: "description",
        content:
          "Manage the people on your W²ander trips: add a name, email, phone and birthday, then send an invitation so they can sign in.",
      },
      { property: "og:title", content: "Users — W²ander trip planner" },
      { property: "og:description", content: "Add and invite the people who travel with you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: canonicalUrl("/users") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/users") }],
  }),
  component: UsersPage,
});

type Draft = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  birthday: string;
  role: MemberRole;
};

const EMPTY: Draft = { name: "", email: "", phone: "", birthday: "", role: "member" };

function UsersPage() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { isAdmin, ready: roleReady } = useIsAdmin();
  const { members, loading, refetch } = useMembers();
  const invite = useServerFn(inviteMember);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth" });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (ready && user && roleReady && !isAdmin) navigate({ to: "/" });
  }, [ready, user, roleReady, isAdmin, navigate]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const startNew = () => {
    setDraft(EMPTY);
    setOpen(true);
  };

  const startEdit = (m: Member) => {
    setDraft({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      birthday: m.birthday ?? "",
      role: m.role,
    });
    setOpen(true);
  };


  const save = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim(),
        birthday: draft.birthday || null,
        role: draft.role,
      };
      if (draft.id) {
        const { error } = await supabase.from("members").update(payload).eq("id", draft.id);
        if (error) throw error;
        toast.success("Saved");
      } else {
        const { error } = await supabase.from("members").insert(payload);
        if (error) throw error;
        toast.success(`${firstName(payload.name)} added`);
      }
      setOpen(false);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that person");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: Member) => {
    if (!window.confirm(`Remove ${m.name}?`)) return;
    const { error } = await supabase.from("members").delete().eq("id", m.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed");
    await refetch();
  };

  const sendInvite = async (m: Member) => {
    setInvitingId(m.id);
    try {
      const res = await invite({ data: { memberId: m.id, redirectTo: `${window.location.origin}/set-password` } });
      toast.success(
        res?.mode === "reset"
          ? `${m.name} already has an account. Sent a link to set their password to ${m.email}`
          : `Invitation sent to ${m.email}`,
      );
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send that invitation");
    } finally {
      setInvitingId(null);
    }
  };

  if (!ready || !roleReady) return null;

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">People</p>
            <h1 className="mt-1 font-serif text-3xl font-medium">Family & friends</h1>
            <p className="mt-2 text-muted-foreground">
              {isAdmin
                ? "Add everyone who travels with you, then invite them to sign in."
                : "These are the people on your trips. Only the admin can add or invite people."}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={startNew}>
              <Plus className="mr-1 h-4 w-4" /> Add person
            </Button>
          )}
        </div>

        {loading ? null : members.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-12 text-center">
            <h2 className="font-serif text-xl font-medium">No people yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a person, invite them, then add them to trips from each trip’s Edit page.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-lg font-medium">{m.name}</h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {roleLabel(m.role)}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                      {m.userId ? "Active" : !m.email ? "No login" : m.invitedAt ? "Invited" : "Not invited"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{m.email || "No email — can be added to trips and bookings, but can’t sign in"}</p>
                  <p className="text-xs text-muted-foreground">
                    {[m.phone, formatBirthday(m.birthday)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    {!m.userId && m.email && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => sendInvite(m)}
                        disabled={invitingId === m.id}
                      >
                        <Mail className="mr-1.5 h-4 w-4" />
                        {m.invitedAt ? "Resend invite" : "Invite"}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => startEdit(m)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(m)}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {draft.id ? "Edit person" : "Add person"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="m-name" className="mb-1.5 block">
                Name
              </Label>
              <Input id="m-name" value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="m-email" className="mb-1.5 block">
                Email <span className="font-normal text-muted-foreground">(optional — needed to sign in)</span>
              </Label>
              <Input
                id="m-email"
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="m-phone" className="mb-1.5 block">
                  Phone
                </Label>
                <Input
                  id="m-phone"
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="m-birthday" className="mb-1.5 block">
                  Birthday
                </Label>
                <Input
                  id="m-birthday"
                  type="date"
                  value={draft.birthday}
                  onChange={(e) => set("birthday", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="m-role" className="mb-1.5 block">
                Access
              </Label>
              <Select value={draft.role} onValueChange={(v) => set("role", v as MemberRole)}>
                <SelectTrigger id="m-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Traveler</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Admins see every trip and manage people. Travelers only see the trips you add them to.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy || !draft.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
