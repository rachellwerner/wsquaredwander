import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, FileUp, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMembers } from "@/lib/use-members";
import { parseTripFileText, planImport, type ImportPlan } from "@/lib/trip-import";
import { useImportTrip } from "@/lib/use-import";
import { ACTIVITY_META, formatShortDate, tripLengthDays, type Trip } from "@/lib/trips";

export function ImportTripDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: (trip: Trip) => void;
}) {
  const { members } = useMembers();
  const importTrip = useImportTrip();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  const { plan, error } = useMemo((): { plan: ImportPlan | null; error: string | null } => {
    if (!text.trim()) return { plan: null, error: null };
    try {
      return { plan: planImport(parseTripFileText(text), members), error: null };
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [text, members]);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) {
      toast.error("That file is too big for a trip file.");
      return;
    }
    setText(await f.text());
  };

  const go = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const trip = await importTrip(plan);
      toast.success(`Imported ${trip.title}`);
      onOpenChange(false);
      onImported(trip);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const counts = plan
    ? (Object.keys(ACTIVITY_META) as (keyof typeof ACTIVITY_META)[])
        .map((t) => ({ t, n: plan.activities.filter((a) => a.type === t).length }))
        .filter((c) => c.n > 0)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Import a trip</DialogTitle>
          <DialogDescription>
            Upload a W²ander trip file (<code>.w2ander.json</code>) or paste one — for example, one Claude made for you
            in a planning chat. You’ll see a preview before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <div
          className="space-y-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void readFile(e.dataTransfer.files[0]);
          }}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json,text/plain"
            className="hidden"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
          <Button variant="outline" className="w-full" onClick={() => fileInput.current?.click()}>
            <FileUp className="mr-2 h-4 w-4" /> Choose file
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='…or paste it here: { "format": "w2ander-trip", "trip": { … }, "bookings": [ … ] }'
            rows={6}
            className="font-mono text-xs"
          />
        </div>

        {error && (
          <p className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        {plan && (
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <p className="font-serif text-xl font-medium">{plan.trip.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatShortDate(plan.trip.startDate)} — {formatShortDate(plan.trip.endDate)} ·{" "}
                  {tripLengthDays(plan.trip)} days
                </p>
              </div>
            </div>
            <p className="text-sm">
              {plan.activities.length} booking{plan.activities.length === 1 ? "" : "s"}
              {counts.length > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({counts.map((c) => `${c.n} ${(c.n === 1 ? ACTIVITY_META[c.t].label : ACTIVITY_META[c.t].plural).toLowerCase()}`).join(", ")})
                </span>
              )}
              {plan.votes.length > 0 && ` · ${plan.votes.length} vote${plan.votes.length === 1 ? "" : "s"} to start`}
            </p>
            {plan.people.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {plan.people.map((p) => (
                  <span
                    key={p.name}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.member ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground line-through"
                    }`}
                  >
                    {p.member ? <Check className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                    {p.member ? p.member.name : p.name}
                  </span>
                ))}
              </div>
            )}
            {plan.warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {plan.warnings.slice(0, 6).map((w, i) => (
                  <li key={i} className="flex gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-accent" /> {w}
                  </li>
                ))}
                {plan.warnings.length > 6 && <li>…and {plan.warnings.length - 6} more.</li>}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              People are added as view-only; you can switch anyone to “Can edit” on the trip’s Edit page.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={go} disabled={!plan || busy}>
            {busy ? "Importing…" : "Import trip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
