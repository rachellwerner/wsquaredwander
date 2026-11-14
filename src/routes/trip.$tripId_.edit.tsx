import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTrip, useTripPeopleAdmin } from "@/lib/use-trips";
import { useMembers } from "@/lib/use-members";
import { initials } from "@/lib/members";
import type { Trip } from "@/lib/trips";

export const Route = createFileRoute("/trip/$tripId_/edit")({
  ssr: false,
  component: TripEdit,
});

const EMOJIS = ["✈️", "🏖️", "🏔️", "🍷", "🍝", "🗽", "🗼", "🏛️", "🌋", "🚆", "🏝️", "🌅", "🍀", "🥃"];

type Details = Pick<Trip, "title" | "destination" | "startDate" | "endDate" | "coverEmoji">;

function TripEdit() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const { trip, ready, canEdit, isAdmin, updateTrip } = useTrip(tripId);

  // Edit a local copy and save shortly after typing stops.
  const [draft, setDraft] = useState<Details | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<Details>>({});

  useEffect(() => {
    if (trip && !draft) {
      setDraft({
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        coverEmoji: trip.coverEmoji,
      });
    }
  }, [trip, draft]);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (Object.keys(pending.current).length) {
      updateTrip(pending.current);
      pending.current = {};
    }
  };
  // Save anything still pending when leaving the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => flush(), []);

  const set = <K extends keyof Details>(k: K, v: Details[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    pending.current = { ...pending.current, [k]: v };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  if (!ready) return null;
  if (!trip || !canEdit || !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="mb-4 text-muted-foreground">
            {trip && !canEdit ? "You can view this trip but not edit it." : "Trip not found."}
          </p>
          <Link to="/">
            <Button variant="outline">Back to trips</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            to="/trip/$tripId"
            params={{ tripId: trip.id }}
            onClick={flush}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to trip
          </Link>
          <Button
            onClick={() => {
              flush();
              navigate({ to: "/trip/$tripId", params: { tripId: trip.id } });
            }}
          >
            <Check className="mr-1 h-4 w-4" /> Done
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="mb-1 font-serif text-3xl font-medium">Trip details</h1>
        <p className="mb-8 text-muted-foreground">Changes save automatically.</p>

        <div className="space-y-6">
          <div>
            <Label className="mb-2 block">Cover</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => set("coverEmoji", e)}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border text-xl transition-all ${
                    draft.coverEmoji === e
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "bg-card hover:bg-secondary"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="title" className="mb-1.5 block">
              Trip name
            </Label>
            <Input id="title" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Ireland with the parents" />
          </div>

          <div>
            <Label htmlFor="destination" className="mb-1.5 block">
              Destination
            </Label>
            <Input
              id="destination"
              value={draft.destination}
              onChange={(e) => set("destination", e.target.value)}
              placeholder="Dublin, Kerry & Cork"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Also helps the map find places.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start" className="mb-1.5 block">
                Start date
              </Label>
              <Input id="start" type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="end" className="mb-1.5 block">
                End date
              </Label>
              <Input
                id="end"
                type="date"
                value={draft.endDate}
                min={draft.startDate || undefined}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          </div>
        </div>

        {isAdmin && <TripPeople trip={trip} />}
      </main>
    </div>
  );
}

function TripPeople({ trip }: { trip: Trip }) {
  const { members, loading } = useMembers();
  const { setPerson } = useTripPeopleAdmin(trip.id);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (memberId: string, on: boolean, canEdit = false) => {
    setBusy(memberId);
    try {
      await setPerson(memberId, on, canEdit);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update that person");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-12 border-t pt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium">People on this trip</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only people added here can see the trip. Turn on <span className="font-medium">Can edit</span> to let
            them add and change bookings.
          </p>
        </div>
        <Link to="/users">
          <Button variant="outline" size="sm">
            <UserPlus className="mr-1.5 h-4 w-4" /> Add someone new
          </Button>
        </Link>
      </div>

      {loading ? null : (
        <ul className="divide-y rounded-xl border bg-card">
          {members.map((m) => {
              const onTrip = trip.people.find((p) => p.memberId === m.id);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => run(m.id, !onTrip)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-pressed={!!onTrip}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        onTrip ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/60"
                      }`}
                    >
                      {onTrip ? <Check className="h-4 w-4" /> : initials(m.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {onTrip ? "On this trip" : "Tap to add"}
                        {!m.email ? " · no login" : !m.userId ? " · hasn’t signed in yet" : ""}
                      </span>
                    </span>
                  </button>
                  {onTrip && m.email && m.role !== "admin" && (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      Can edit
                      <Switch
                        checked={onTrip.canEdit}
                        disabled={busy === m.id}
                        onCheckedChange={(v) => run(m.id, true, v)}
                      />
                    </label>
                  )}
                </li>
              );
            })}
          {members.length <= 1 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No one to add yet — add people on the{" "}
              <Link to="/users" className="font-medium text-primary underline underline-offset-4">
                People page
              </Link>
              .
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
