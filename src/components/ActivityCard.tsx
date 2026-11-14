import { Plane, Hotel, Sparkles, Car, Clock, MapPin, Pencil, Trash2, ExternalLink, Navigation } from "lucide-react";
import type { Activity, ActivityType, TripPerson } from "@/lib/trips";
import { ACTIVITY_META, mapsLink, normalizeType } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { WhoBadges } from "@/components/WhoChips";

const icons: Record<ActivityType, typeof Plane> = {
  airfare: Plane,
  hotel: Hotel,
  transportation: Car,
  activity: Sparkles,
};

export function ActivityCard({
  activity,
  onEdit,
  onDelete,
  readOnly,
  people = [],
  compact,
}: {
  activity: Activity;
  onEdit?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
  people?: TripPerson[];
  compact?: boolean;
}) {
  const directions = mapsLink(activity);
  const type = normalizeType(activity.type);
  const Icon = icons[type];
  const meta = ACTIVITY_META[type];
  const time = [activity.startTime, activity.endTime].filter(Boolean).join(" → ");

  return (
    <div className="group relative rounded-xl border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.fg}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {meta.label}
              {activity.category ? ` · ${activity.category}` : ""}
              {activity.mode ? ` · ${activity.mode}` : ""}
            </span>
            {time && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {time}
                {activity.duration ? ` (${activity.duration})` : ""}
              </span>
            )}
          </div>
          <h4 className="mt-0.5 font-serif text-lg font-medium text-foreground">{activity.title}</h4>

          {type === "airfare" && (
            <div className="mt-1 space-y-0.5 text-sm text-foreground/80">
              {(activity.from || activity.to) && (
                <p>
                  <span className="font-medium">{activity.from || "—"}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="font-medium">{activity.to || "—"}</span>
                </p>
              )}
              {(activity.airline || activity.flightNumber) && (
                <p className="text-muted-foreground">
                  {[activity.airline, activity.flightNumber].filter(Boolean).join(" · ")}
                </p>
              )}
              {(activity.terminal || activity.seats) && (
                <p className="text-xs text-muted-foreground">
                  {activity.terminal ? `Terminal ${activity.terminal}` : ""}
                  {activity.terminal && activity.seats ? " · " : ""}
                  {activity.seats ? `Seats ${activity.seats}` : ""}
                </p>
              )}
            </div>
          )}

          {type === "transportation" && (
            <div className="mt-1 space-y-0.5 text-sm text-foreground/80">
              {(activity.pickup || activity.dropoff) && (
                <p>
                  <span className="font-medium">{activity.pickup || "—"}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="font-medium">{activity.dropoff || "—"}</span>
                </p>
              )}
              {activity.provider && <p className="text-muted-foreground">{activity.provider}</p>}
            </div>
          )}

          {type === "hotel" && (
            <div className="mt-1 space-y-0.5 text-sm text-foreground/80">
              {activity.hotelName && <p className="font-medium">{activity.hotelName}</p>}
              {activity.address && (
                <p className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {activity.address}
                </p>
              )}
              {(activity.checkIn || activity.checkOut) && (
                <p className="text-xs text-muted-foreground">
                  {activity.checkIn ? `Check-in ${activity.checkIn}` : ""}
                  {activity.checkIn && activity.checkOut ? " · " : ""}
                  {activity.checkOut ? `Check-out ${activity.checkOut}` : ""}
                </p>
              )}
              {(activity.roomType || activity.guests) && (
                <p className="text-xs text-muted-foreground">
                  {[activity.roomType, activity.guests ? `${activity.guests} guests` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          )}

          {type === "activity" && (
            <div className="mt-1 space-y-0.5 text-sm">
              {activity.location && (
                <p className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {activity.location}
                </p>
              )}
              {(activity.meetingPoint || activity.tickets) && (
                <p className="text-xs text-muted-foreground">
                  {activity.meetingPoint ? `Meet: ${activity.meetingPoint}` : ""}
                  {activity.meetingPoint && activity.tickets ? " · " : ""}
                  {activity.tickets ? `Tickets: ${activity.tickets}` : ""}
                </p>
              )}
            </div>
          )}

          <WhoBadges who={activity.who} people={people} />

          {(activity.confirmation || activity.cost || activity.url || directions) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {activity.confirmation && <span>Conf. {activity.confirmation}</span>}
              {activity.cost && <span>{activity.cost}</span>}
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-8 items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Navigation className="h-3 w-3" /> Directions
                </a>
              )}
              {activity.url && (
                <a
                  href={activity.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-8 items-center gap-1 font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Website
                </a>
              )}
            </div>
          )}

          {activity.notes && !compact && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.notes}</p>
          )}
        </div>

        {!readOnly && (
          <div className="-mr-2 -mt-1 flex shrink-0 flex-col gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              aria-label="Delete"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}