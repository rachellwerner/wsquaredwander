import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Map as MapIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Activity, ActivityType, Trip } from "@/lib/trips";
import {
  ACTIVITY_META,
  BOOKING_TYPES,
  dayIndexFor,
  daysBetween,
  formatDayLabel,
  normalizeType,
  sortActivities,
  todayIso,
  tripPlace,
  uid,
} from "@/lib/trips";
import { ActivityCard } from "./ActivityCard";
import { BOOKING_ICONS } from "./booking-icons";
import type { BookingDraft } from "./BookingFields";

// Leaflet touches `window`, so only load the map in the browser.
const TripMap = lazy(() => import("./TripMap"));

type Filter = "all" | ActivityType;
type Status = "all" | "confirmed" | "planning";
type View = "summary" | "detail";
const VIEW_KEY = "w2ander:itinerary-view";

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "detail" ? "detail" : "summary";
  } catch {
    return "summary";
  }
}

export function TripDayList({
  trip,
  readOnly,
  onAdd,
  onUpdate,
  onDelete,
  focusId,
}: {
  trip: Trip;
  readOnly?: boolean;
  onAdd?: (a: Omit<Activity, "id">) => void;
  onUpdate?: (a: Activity) => void;
  onDelete?: (id: string) => void;
  /** Entry to open and scroll to (e.g. picked on the calendar). */
  focusId?: string;
}) {
  const days = useMemo(() => daysBetween(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const [filter, setFilter] = useState<Filter>("all");
  const [status, setStatus] = useState<Status>("all");
  const [view, setViewState] = useState<View>("summary");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<{ key: string; dayIndex: number; type: ActivityType } | null>(null);
  const [mapDay, setMapDay] = useState<number | null>(null);
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(todayIso());
    setViewState(readView());
  }, []);

  const setView = (v: View) => {
    setViewState(v);
    setOpen({});
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not saved; fine */
    }
  };

  // Open and scroll to an entry picked elsewhere (the calendar).
  useEffect(() => {
    if (!focusId) return;
    setFilter("all");
    setStatus("all");
    setOpen((o) => ({ ...o, [focusId]: true }));
    const t = setTimeout(() => {
      const el = document.getElementById(`entry-${focusId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-primary/50", "rounded-xl");
      setTimeout(() => el?.classList.remove("ring-2", "ring-primary/50"), 1800);
    }, 60);
    return () => clearTimeout(t);
  }, [focusId]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(BOOKING_TYPES.map((t) => [t, 0])) as Record<ActivityType, number>;
    trip.activities.forEach((a) => (c[normalizeType(a.type)] += 1));
    return c;
  }, [trip.activities]);
  const confirmedCount = useMemo(() => trip.activities.filter((a) => a.confirmed).length, [trip.activities]);

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
        <p className="text-muted-foreground">Add trip dates to start building your day-by-day plan.</p>
      </div>
    );
  }

  /** Hotels live on their check-in day. */
  const placeOnDay = (d: BookingDraft, fallback: number) => {
    if (d.type === "hotel" && d.checkIn) {
      const i = dayIndexFor(trip, d.checkIn);
      if (i >= 0) return i;
    }
    return fallback;
  };

  const startAdd = (dayIndex: number) => {
    setAdding({ key: uid(), dayIndex, type: filter === "all" ? "activity" : filter });
  };

  const isOpen = (id: string) => open[id] ?? view === "detail";
  const matching = (a: Activity) =>
    (filter === "all" || normalizeType(a.type) === filter) &&
    (status === "all" || (status === "confirmed") === !!a.confirmed);
  const filtering = filter !== "all" || status !== "all";
  const visibleDays = days
    .map((date, dayIndex) => ({ date, dayIndex, items: sortActivities(trip.activities.filter((a) => a.dayIndex === dayIndex && matching(a))) }))
    .filter((d) => !filtering || d.items.length > 0 || adding?.dayIndex === d.dayIndex);

  return (
    <div>
      {/* Quick lists + summary/detail */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0" role="tablist" aria-label="Show">
          <FilterChip on={filter === "all"} onClick={() => setFilter("all")} label="All" count={trip.activities.length} />
          {BOOKING_TYPES.map((t) => (
            <FilterChip
              key={t}
              on={filter === t}
              onClick={() => setFilter(filter === t ? "all" : t)}
              label={ACTIVITY_META[t].plural}
              count={counts[t]}
              type={t}
            />
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-auto">
        <div className="inline-flex rounded-lg border bg-card p-0.5 text-xs font-medium" role="group" aria-label="Booking status">
          {(
            [
              ["all", "All", null],
              ["confirmed", "Confirmed", confirmedCount],
              ["planning", "Planning", trip.activities.length - confirmedCount],
            ] as const
          ).map(([v, label, n]) => (
            <button
              key={v}
              type="button"
              aria-pressed={status === v}
              onClick={() => setStatus(v)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors ${
                status === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {n !== null && <span className="tabular-nums opacity-70">{n}</span>}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border bg-card p-0.5 text-xs font-medium">
          {(
            [
              ["summary", "Summary", ChevronsDownUp],
              ["detail", "Detail", ChevronsUpDown],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {filtering && visibleDays.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
          {status === "all"
            ? `No ${filter === "all" ? "entries" : ACTIVITY_META[filter].plural.toLowerCase()} yet.`
            : `Nothing ${status === "confirmed" ? "confirmed" : "still in planning"}${
                filter === "all" ? "" : ` in ${ACTIVITY_META[filter].plural.toLowerCase()}`
              }.`}
          {!readOnly && filter !== "all" && status === "all" && (
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => startAdd(0)}>
                <Plus className="mr-1 h-4 w-4" /> Add {ACTIVITY_META[filter].label.toLowerCase()}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className={filtering ? "space-y-6" : "space-y-9"}>
        {visibleDays.map(({ date, dayIndex, items }) => {
          const isToday = todayIso(date) === today;
          const newHere = adding?.dayIndex === dayIndex ? adding : null;
          const allForMap = sortActivities(trip.activities.filter((a) => a.dayIndex === dayIndex));

          return (
            <section key={dayIndex} id={`day-${dayIndex + 1}`} className="scroll-mt-28">
              <div className="mb-3 flex items-end justify-between gap-3 border-b pb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                    Day {dayIndex + 1}
                    {isToday && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] tracking-wider text-primary-foreground">
                        Today
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-lg font-medium sm:text-xl">{formatDayLabel(date)}</h3>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {filter === "all" && allForMap.length > 0 && (
                    <Button
                      size="sm"
                      variant={mapDay === dayIndex ? "secondary" : "ghost"}
                      onClick={() => setMapDay(mapDay === dayIndex ? null : dayIndex)}
                      aria-label="Show map for this day"
                    >
                      <MapIcon className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Map</span>
                    </Button>
                  )}
                  {!readOnly && (
                    <Button size="sm" variant="outline" onClick={() => startAdd(dayIndex)} disabled={!!adding}>
                      <Plus className="mr-1 h-4 w-4" /> Add
                    </Button>
                  )}
                </div>
              </div>

              {mapDay === dayIndex && filter === "all" && (
                <div className="mb-3">
                  <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-secondary" />}>
                    <TripMap
                      activities={allForMap}
                      near={tripPlace(trip)}
                      onPinned={readOnly ? undefined : onUpdate}
                      className="h-64 sm:h-80"
                    />
                  </Suspense>
                </div>
              )}

              <div className="space-y-2">
                {items.map((a) => (
                  <div key={a.id} id={`entry-${a.id}`} className="scroll-mt-28 transition-shadow">
                    <ActivityCard
                      activity={a}
                      people={trip.people}
                      tripId={trip.id}
                      readOnly={readOnly}
                      expanded={isOpen(a.id)}
                      onExpandedChange={(o) => setOpen((m) => ({ ...m, [a.id]: o }))}
                      onSave={readOnly ? undefined : (d) => onUpdate?.({ ...(d as Activity), id: a.id, dayIndex: placeOnDay(d, a.dayIndex) })}
                      onToggleConfirmed={readOnly ? undefined : (c) => onUpdate?.({ ...a, confirmed: c })}
                      onDelete={
                        readOnly
                          ? undefined
                          : () => {
                              if (window.confirm(`Delete “${a.title}”?`)) onDelete?.(a.id);
                            }
                      }
                    />
                  </div>
                ))}

                {newHere && (
                  <ActivityCard
                    key={newHere.key}
                    activity={{ type: newHere.type, title: "", dayIndex }}
                    people={trip.people}
                    tripId={trip.id}
                    startEditing
                    onSave={(d) => {
                      const { id: _none, ...rest } = d;
                      onAdd?.({ ...rest, dayIndex: placeOnDay(d, dayIndex) });
                      setAdding(null);
                    }}
                    onCancelNew={() => setAdding(null)}
                  />
                )}

                {items.length === 0 && !newHere && (
                  <div className="rounded-lg border border-dashed bg-card/40 px-4 py-4 text-center text-sm text-muted-foreground">
                    Nothing planned yet.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({
  on,
  onClick,
  label,
  count,
  type,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  count: number;
  type?: ActivityType;
}) {
  const Icon = type ? BOOKING_ICONS[type] : null;
  const onClass = type ? `${ACTIVITY_META[type].bg} ${ACTIVITY_META[type].fg} border-transparent` : "bg-foreground text-background border-transparent";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
        on ? onClass : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
      <span className={`tabular-nums ${on ? "opacity-80" : "opacity-60"}`}>{count}</span>
    </button>
  );
}
