import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Map as MapIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Activity, Trip } from "@/lib/trips";
import { daysBetween, formatDayLabel, sortActivities, todayIso } from "@/lib/trips";
import { ActivityCard } from "./ActivityCard";
import { ActivityDialog } from "./ActivityDialog";

// Leaflet touches `window`, so only load the map in the browser.
const TripMap = lazy(() => import("./TripMap"));

export function TripDayList({
  trip,
  readOnly,
  onAdd,
  onUpdate,
  onDelete,
}: {
  trip: Trip;
  readOnly?: boolean;
  onAdd?: (a: Omit<Activity, "id">) => void;
  onUpdate?: (a: Activity) => void;
  onDelete?: (id: string) => void;
}) {
  const days = useMemo(() => daysBetween(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mapDay, setMapDay] = useState<number | null>(null);
  const [today, setToday] = useState("");
  useEffect(() => setToday(todayIso()), []);

  const openAdd = (dayIndex: number) => {
    setEditingDay(dayIndex);
    setEditingActivity(null);
    setDialogOpen(true);
  };
  const openEdit = (a: Activity) => {
    setEditingDay(a.dayIndex);
    setEditingActivity(a);
    setDialogOpen(true);
  };

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
        <p className="text-muted-foreground">Add trip dates to start building your day-by-day plan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {days.map((date, dayIndex) => {
        const dayActivities = sortActivities(trip.activities.filter((a) => a.dayIndex === dayIndex));
        const isToday = todayIso(date) === today;

        return (
          <section key={dayIndex} id={`day-${dayIndex + 1}`} className="relative scroll-mt-20">
            <div className="mb-4 flex items-end justify-between gap-3 border-b pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                  Day {dayIndex + 1}
                  {isToday && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] tracking-wider text-primary-foreground">
                      Today
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-xl font-medium sm:text-2xl">{formatDayLabel(date)}</h3>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {dayActivities.length > 0 && (
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
                  <Button size="sm" variant="outline" onClick={() => openAdd(dayIndex)}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                )}
              </div>
            </div>

            {mapDay === dayIndex && (
              <div className="mb-4">
                <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-secondary" />}>
                  <TripMap
                    activities={dayActivities}
                    near={trip.destination}
                    onPinned={readOnly ? undefined : onUpdate}
                    className="h-64 sm:h-80"
                  />
                </Suspense>
              </div>
            )}

            {dayActivities.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
                {readOnly ? "Nothing planned yet." : "Nothing planned. Add a flight, hotel, transportation, or an activity."}
              </div>
            ) : (
              <div className="space-y-3">
                {dayActivities.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    people={trip.people}
                    readOnly={readOnly}
                    onEdit={() => openEdit(a)}
                    onDelete={() => {
                      if (window.confirm(`Delete “${a.title}”?`)) onDelete?.(a.id);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {!readOnly && editingDay !== null && (
        <ActivityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={editingActivity}
          dayIndex={editingDay}
          people={trip.people}
          tripId={trip.id}
          onSave={(draft) => {
            if (editingActivity) {
              onUpdate?.({ ...editingActivity, ...draft, id: editingActivity.id });
            } else {
              onAdd?.(draft);
            }
          }}
        />
      )}
    </div>
  );
}
