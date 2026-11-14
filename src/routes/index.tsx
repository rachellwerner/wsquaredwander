import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, MapPin, Calendar, Compass, Mail, ChevronRight, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/use-auth";
import { useTrips } from "@/lib/use-trips";
import { formatShortDate, todayIso, tripLengthDays, type Trip } from "@/lib/trips";
import { NewTripDialog } from "@/components/NewTripDialog";
import { PasteConfirmationDialog } from "@/components/PasteConfirmationDialog";
import { ImportTripDialog } from "@/components/ImportTripDialog";
import { canonicalUrl } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "W²ander — Family trip planner" },
      { name: "description", content: "Plan family trips day-by-day with W²ander (read “Wander Squared”)." },
      { property: "og:title", content: "W²ander — Family trip planner" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl("/") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/") }],
  }),
  component: Index,
});

function status(trip: Trip, today: string): "now" | "upcoming" | "past" | "tbd" {
  if (!trip.startDate) return "tbd";
  const end = trip.endDate || trip.startDate;
  if (today >= trip.startDate && today <= end) return "now";
  return today < trip.startDate ? "upcoming" : "past";
}

function daysUntil(iso: string, today: string) {
  const ms = new Date(iso + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime();
  return Math.round(ms / 86_400_000);
}

function Index() {
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const { trips, ready, isAdmin, createTrip } = useTrips();
  const [newOpen, setNewOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [today, setToday] = useState("");
  useEffect(() => setToday(todayIso()), []);

  useEffect(() => {
    if (authReady && !user) navigate({ to: "/auth" });
  }, [authReady, user, navigate]);

  const handleCreate = async (details: Partial<Trip>) => {
    try {
      const trip = await createTrip(details);
      navigate({ to: "/trip/$tripId/edit", params: { tripId: trip.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create that trip");
    }
  };

  const groups = {
    now: trips.filter((t) => status(t, today) === "now"),
    upcoming: trips.filter((t) => ["upcoming", "tbd"].includes(status(t, today))),
    past: trips.filter((t) => status(t, today) === "past").reverse(),
  };

  return (
    <AppShell wide>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Trip planner</p>
            <h1 className="mt-2 font-serif text-3xl font-medium leading-tight sm:text-5xl">
              Plan it. Live it. Remember it.
            </h1>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp className="mr-1.5 h-4 w-4" /> Import
              </Button>
              <Button variant="secondary" onClick={() => setPasteOpen(true)}>
                <Mail className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Paste confirmation</span>
                <span className="sm:hidden">Paste</span>
              </Button>
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> New trip
              </Button>
            </div>
          )}
        </div>

        {!ready || !today ? null : trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center sm:p-12">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-accent">
              <Compass className="h-6 w-6" />
            </div>
            <h3 className="font-serif text-xl font-medium">No trips yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Start planning your next family adventure."
                : "When you’re added to a trip, it’ll show up here."}
            </p>
            {isAdmin && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button onClick={() => setNewOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Create your first trip
                </Button>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <FileUp className="mr-1.5 h-4 w-4" /> Import a trip file
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {groups.now.length > 0 && (
              <section>
                <h2 className="mb-3 font-serif text-2xl font-medium">Happening now</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {groups.now.map((t) => (
                    <TripCard key={t.id} trip={t} today={today} highlight />
                  ))}
                </div>
              </section>
            )}
            {groups.upcoming.length > 0 && (
              <section>
                <h2 className="mb-3 font-serif text-2xl font-medium">Coming up</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {groups.upcoming.map((t) => (
                    <TripCard key={t.id} trip={t} today={today} />
                  ))}
                </div>
              </section>
            )}
            {groups.past.length > 0 && (
              <section>
                <h2 className="mb-3 font-serif text-2xl font-medium text-muted-foreground">Past trips</h2>
                <div className="grid gap-4 opacity-80 sm:grid-cols-2">
                  {groups.past.map((t) => (
                    <TripCard key={t.id} trip={t} today={today} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <NewTripDialog open={newOpen} onOpenChange={setNewOpen} onCreate={handleCreate} />
      <PasteConfirmationDialog open={pasteOpen} onOpenChange={setPasteOpen} />
      <ImportTripDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(trip) => navigate({ to: "/trip/$tripId", params: { tripId: trip.id } })}
      />
    </AppShell>
  );
}

function TripCard({ trip, today, highlight }: { trip: Trip; today: string; highlight?: boolean }) {
  const days = tripLengthDays(trip);
  const s = status(trip, today);
  const countdown =
    s === "upcoming" && trip.startDate
      ? (() => {
          const n = daysUntil(trip.startDate, today);
          return n === 1 ? "Tomorrow!" : `In ${n} days`;
        })()
      : null;

  return (
    <Link
      to="/trip/$tripId"
      params={{ tripId: trip.id }}
      className={`group block rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        highlight ? "ring-2 ring-primary/30" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{trip.coverEmoji ?? "🌍"}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-xl font-medium">{trip.title}</h3>
          {trip.destination && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {trip.destination}
            </p>
          )}
        </div>
        {countdown && (
          <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">{countdown}</span>
        )}
        {s === "now" && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
            On now <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {trip.startDate ? formatShortDate(trip.startDate) : "Dates TBD"}
          {trip.endDate ? ` — ${formatShortDate(trip.endDate)}` : ""}
        </span>
        <span>
          {days > 0 ? `${days} day${days === 1 ? "" : "s"}` : ""}
          {trip.activities.length > 0 ? ` · ${trip.activities.length} plans` : ""}
        </span>
      </div>
    </Link>
  );
}
