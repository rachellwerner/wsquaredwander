import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, Sunrise, Vote } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ActivityCard } from "@/components/ActivityCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { useMe } from "@/lib/use-members";
import { useTrip, useTrips } from "@/lib/use-trips";
import { usePolls } from "@/lib/use-polls";
import {
  dayIndexFor,
  daysBetween,
  formatDayLabel,
  formatShortDate,
  sortActivities,
  todayIso,
  tripPlace,
  type Activity,
  type Trip,
} from "@/lib/trips";

const TripMap = lazy(() => import("@/components/TripMap"));

export const Route = createFileRoute("/today")({
  ssr: false,
  head: () => ({ meta: [{ title: "Today — W²ander" }] }),
  component: TodayPage,
});

function nowHHMM(d = new Date()) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Bookings that matter on a given day: things scheduled that day + hotels you're staying at that night. */
function plansForDay(trip: Trip, dayIndex: number, iso: string): Activity[] {
  const scheduled = trip.activities.filter((a) => a.dayIndex === dayIndex);
  const stays = trip.activities.filter(
    (a) => a.type === "hotel" && a.dayIndex !== dayIndex && a.checkIn && a.checkOut && a.checkIn < iso && iso < a.checkOut,
  );
  return [...sortActivities(scheduled), ...stays];
}

function TodayPage() {
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const { trips, ready } = useTrips();
  const [today, setToday] = useState("");
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => {
      setToday(todayIso());
      setNow(nowHHMM());
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (authReady && !user) navigate({ to: "/auth" });
  }, [authReady, user, navigate]);

  const current = useMemo(
    () => trips.filter((t) => t.startDate && today >= t.startDate && today <= (t.endDate || t.startDate)),
    [trips, today],
  );
  const next = useMemo(
    () =>
      trips
        .filter((t) => t.startDate && t.startDate > today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0],
    [trips, today],
  );
  const [pickedId, setPickedId] = useState<string | null>(null);
  const tripId = pickedId ?? current[0]?.id;

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        {!ready || !today ? null : !tripId ? (
          <NothingToday next={next} today={today} />
        ) : (
          <>
            {current.length > 1 && (
              <div className="mb-4 flex gap-2 overflow-x-auto">
                {current.map((t) => (
                  <Button key={t.id} size="sm" variant={t.id === tripId ? "default" : "outline"} onClick={() => setPickedId(t.id)}>
                    {t.title}
                  </Button>
                ))}
              </div>
            )}
            <TodayForTrip tripId={tripId} today={today} now={now} />
          </>
        )}
      </main>
    </AppShell>
  );
}

function NothingToday({ next, today }: { next?: Trip; today: string }) {
  const days = next ? Math.round((new Date(next.startDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86_400_000) : 0;
  return (
    <div className="rounded-2xl border border-dashed bg-card/60 p-8 text-center sm:p-12">
      <Sunrise className="mx-auto mb-3 h-10 w-10 text-accent" />
      <h1 className="font-serif text-2xl font-medium">No trip today</h1>
      {next ? (
        <>
          <p className="mt-2 text-muted-foreground">
            Next up: <span className="font-medium text-foreground">{next.title}</span> on{" "}
            {formatShortDate(next.startDate)} — {days === 1 ? "tomorrow!" : `in ${days} days.`}
          </p>
          <Link to="/trip/$tripId" params={{ tripId: next.id }} className="mt-5 inline-block">
            <Button>
              See the plan <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </>
      ) : (
        <p className="mt-2 text-muted-foreground">When a trip is underway, this page shows just what’s happening today.</p>
      )}
    </div>
  );
}

function TodayForTrip({ tripId, today, now }: { tripId: string; today: string; now: string }) {
  const { trip, canEdit, updateActivity } = useTrip(tripId);
  const { me } = useMe();
  const { polls } = usePolls(tripId);
  const [justMine, setJustMine] = useState(false);
  const [showMap, setShowMap] = useState(false);
  if (!trip) return null;

  const days = daysBetween(trip.startDate, trip.endDate);
  const dayIndex = dayIndexFor(trip, today);
  const date = days[dayIndex] ?? new Date(today + "T00:00:00");
  const tomorrowIso = days[dayIndex + 1] ? todayIso(days[dayIndex + 1]!) : null;
  const filter = (list: Activity[]) =>
    justMine && me ? list.filter((a) => !a.who?.length || a.who.includes(me.id)) : list;

  const plans = filter(plansForDay(trip, dayIndex, today));
  const tomorrow = tomorrowIso ? filter(plansForDay(trip, dayIndex + 1, tomorrowIso)) : [];
  const timed = plans.filter((a) => a.startTime && a.dayIndex === dayIndex);
  const nextUp = timed.find((a) => (a.endTime || a.startTime)! >= now) ?? null;
  const openVotes = polls.filter((p) => p.status === "open");
  const meOnTrip = me && trip.people.some((p) => p.memberId === me.id);

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/trip/$tripId"
          params={{ tripId: trip.id }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {trip.title} · Day {dayIndex + 1} of {days.length}
        </Link>
        <h1 className="mt-1 font-serif text-3xl font-medium sm:text-4xl">{formatDayLabel(date)}</h1>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {meOnTrip && (
          <Button size="sm" variant={justMine ? "default" : "outline"} onClick={() => setJustMine((v) => !v)}>
            {justMine ? "Showing just mine" : "Just mine"}
          </Button>
        )}
        {plans.length > 0 && (
          <Button size="sm" variant={showMap ? "secondary" : "outline"} onClick={() => setShowMap((v) => !v)}>
            {showMap ? "Hide map" : "Map of today"}
          </Button>
        )}
      </div>

      {openVotes.length > 0 && (
        <Link
          to="/trip/$tripId"
          params={{ tripId: trip.id }}
          search={{ tab: "vote" }}
          className="mb-5 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm"
        >
          <Vote className="h-5 w-5 shrink-0 text-accent" />
          <span className="flex-1">
            {openVotes.length} open vote{openVotes.length === 1 ? "" : "s"} — <span className="font-medium">{openVotes[0]!.question}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {showMap && (
        <div className="mb-6">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-secondary" />}>
            <TripMap activities={plans} near={tripPlace(trip)} onPinned={canEdit ? updateActivity : undefined} className="h-64 sm:h-80" />
          </Suspense>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-4 py-8 text-center text-muted-foreground">
          Nothing planned today — enjoy the free time.
        </div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-border pl-5">
          {plans.map((a) => {
            const isNext = nextUp?.id === a.id;
            const done = a.dayIndex === dayIndex && a.startTime && (a.endTime || a.startTime) < now;
            return (
              <li key={a.id} className={`relative ${done ? "opacity-60" : ""}`}>
                <span
                  className={`absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 border-background ${
                    isNext ? "bg-primary ring-4 ring-primary/20" : done ? "bg-muted-foreground/40" : "bg-border"
                  }`}
                />
                {isNext && (
                  <div className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary">
                    <CalendarClock className="h-3.5 w-3.5" /> Up next
                  </div>
                )}
                {a.dayIndex !== dayIndex && (
                  <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Staying tonight</div>
                )}
                <ActivityCard activity={a} people={trip.people} readOnly />
              </li>
            );
          })}
        </ol>
      )}

      {tomorrowIso && (
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-xl font-medium text-muted-foreground">
            Tomorrow · {formatDayLabel(days[dayIndex + 1]!)}
          </h2>
          {tomorrow.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing planned yet.</p>
          ) : (
            <ul className="space-y-2">
              {tomorrow.map((a) => (
                <li key={a.id} className="flex items-baseline gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                  <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{a.startTime ?? "—"}</span>
                  <span className="font-medium">{a.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
