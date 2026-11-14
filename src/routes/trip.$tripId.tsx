import { lazy, Suspense, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Map as MapIcon, Pencil, Trash2, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/AppShell";
import { TripHeader } from "@/components/TripHeader";
import { TripDayList } from "@/components/TripDayList";
import { ShareButton } from "@/components/ShareButton";
import { PollsPanel } from "@/components/PollsPanel";
import { useTrip } from "@/lib/use-trips";
import { useMe } from "@/lib/use-members";
import { usePolls } from "@/lib/use-polls";
import { daysBetween, formatDayLabel, sortActivities, type Activity, type Trip } from "@/lib/trips";

const TripMap = lazy(() => import("@/components/TripMap"));

type Tab = "plan" | "map" | "vote";

export const Route = createFileRoute("/trip/$tripId")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab = search["tab"];
    return tab === "map" || tab === "vote" ? { tab } : {};
  },
  component: TripView,
});

function TripView() {
  const { tripId } = Route.useParams();
  const { tab = "plan" } = Route.useSearch();
  const navigate = useNavigate();
  const { trip, ready, canEdit, isAdmin, addActivity, updateActivity, removeActivity, deleteTrip } = useTrip(tripId);
  const { me } = useMe();
  const { polls } = usePolls(tripId);
  const openVotes = polls.filter((p) => p.status === "open").length;

  if (!ready) return null;

  if (!trip) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center px-6">
          <div className="max-w-md text-center">
            <h1 className="font-serif text-3xl">Trip not found</h1>
            <p className="mt-2 text-muted-foreground">
              You may not have been added to this trip yet. Ask Rachel to add you.
            </p>
            <Link to="/" className="mt-6 inline-block">
              <Button>Back to all trips</Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const meId = me && trip.people.some((p) => p.memberId === me.id) ? me.id : null;
  const setTab = (t: Tab) =>
    navigate({ to: "/trip/$tripId", params: { tripId }, search: t === "plan" ? {} : { tab: t }, replace: true });

  const tabs: { id: Tab; label: string; icon: typeof MapIcon; badge?: number }[] = [
    { id: "plan", label: "Itinerary", icon: CalendarDays },
    { id: "map", label: "Map", icon: MapIcon },
    { id: "vote", label: "Vote", icon: Vote, badge: openVotes },
  ];

  return (
    <AppShell>
      <TripHeader
        trip={trip}
        showBack
        actions={
          <>
            {isAdmin && <ShareButton trip={trip} />}
            {canEdit && (
              <Link to="/trip/$tripId/edit" params={{ tripId: trip.id }}>
                <Button variant="secondary">
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              </Link>
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Delete trip">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the trip, its bookings and votes for everyone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        await deleteTrip(trip.id);
                        navigate({ to: "/" });
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        }
      />

      <div className="sticky top-[57px] z-20 border-b bg-background/90 backdrop-blur sm:top-[61px]">
        <div className="mx-auto flex max-w-4xl gap-1 px-4 sm:px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {!!t.badge && (
                <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {tab === "plan" && (
          <TripDayList
            trip={trip}
            readOnly={!canEdit}
            onAdd={addActivity}
            onUpdate={updateActivity}
            onDelete={removeActivity}
          />
        )}
        {tab === "map" && <WholeTripMap trip={trip} onPinned={canEdit ? updateActivity : undefined} />}
        {tab === "vote" && <PollsPanel trip={trip} canEdit={canEdit} meId={meId} onAddActivity={addActivity} />}
      </main>
    </AppShell>
  );
}

function WholeTripMap({ trip, onPinned }: { trip: Trip; onPinned?: (a: Activity) => void }) {
  const days = useMemo(() => daysBetween(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const ordered = useMemo(
    () => days.flatMap((_, i) => sortActivities(trip.activities.filter((a) => a.dayIndex === i))),
    [days, trip.activities],
  );
  // Flights are shown as their departure airport; skip them on the whole-trip map to keep it readable.
  const onMap = ordered.filter((a) => a.type !== "airfare");

  return (
    <div>
      <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-xl bg-secondary" />}>
        <TripMap activities={onMap} near={trip.destination} onPinned={onPinned} className="h-[60vh]" />
      </Suspense>
      <ol className="mt-4 space-y-1.5 text-sm">
        {onMap.map((a, i) => (
          <li key={a.id} className="flex gap-3">
            <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0">
              <span className="font-medium">{a.title}</span>
              <span className="text-muted-foreground"> · {days[a.dayIndex] ? formatDayLabel(days[a.dayIndex]!) : ""}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
