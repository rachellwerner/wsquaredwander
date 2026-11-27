import { Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Users } from "lucide-react";
import type { Trip } from "@/lib/trips";
import { formatShortDate, tripLengthDays } from "@/lib/trips";
import { firstName } from "@/lib/members";

export function TripHeader({
  trip,
  showBack,
  backLabel = "All trips",
  actions,
}: {
  trip: Trip;
  showBack?: boolean;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  const days = tripLengthDays(trip);
  return (
    <div className="relative overflow-hidden border-b bg-card/60">
      <div className="bg-paper absolute inset-0 opacity-70" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {showBack && (
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-medium leading-tight sm:text-4xl">{trip.title || "Untitled trip"}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {trip.startDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatShortDate(trip.startDate)}
                  {trip.endDate ? ` — ${formatShortDate(trip.endDate)}` : ""}
                  {days > 0 ? ` · ${days} days` : ""}
                </span>
              )}
              {trip.people.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> {trip.people.map((p) => firstName(p.name)).join(", ")}
                </span>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}