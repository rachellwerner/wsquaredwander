import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, ExternalLink, MapPin, Navigation, Pencil, Trash2 } from "lucide-react";
import type { Activity, TripPerson } from "@/lib/trips";
import { ACTIVITY_META, formatTime, mapsLink, normalizeType } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { WhoBadges } from "@/components/WhoChips";
import { BOOKING_ICONS } from "@/components/booking-icons";
import {
  BookingDetailFields,
  BookingSummaryFields,
  ConfirmedToggle,
  prepareForSave,
  type BookingDraft,
} from "@/components/BookingFields";

function shortDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function nights(a: Pick<Activity, "checkIn" | "checkOut">) {
  if (!a.checkIn || !a.checkOut) return 0;
  const n = Math.round(
    (new Date(a.checkOut + "T00:00:00").getTime() - new Date(a.checkIn + "T00:00:00").getTime()) / 86_400_000,
  );
  return n > 0 ? n : 0;
}

/** One line under the title with the most useful facts for this kind of entry. */
function summaryLine(a: BookingDraft): string {
  const join = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" · ");
  const route = (x?: string, y?: string) => (x || y ? `${x || "—"} → ${y || "—"}` : "");
  switch (a.type) {
    case "airfare":
      return join(route(a.from, a.to), [a.airline, a.flightNumber].filter(Boolean).join(" "));
    case "transportation":
      return join(a.mode, route(a.pickup, a.dropoff));
    case "hotel": {
      const n = nights(a);
      return join(n ? `${n} night${n === 1 ? "" : "s"}` : "", a.checkIn && `${shortDate(a.checkIn)} – ${shortDate(a.checkOut)}`);
    }
    case "meal":
      return join(a.category, a.location);
    default:
      return join(a.category, a.location);
  }
}

function hasDetails(a: BookingDraft) {
  const keys: (keyof BookingDraft)[] = [
    "notes", "url", "confirmation", "cost", "duration", "terminal", "seats", "provider",
    "roomType", "guests", "address", "meetingPoint", "tickets",
  ];
  return keys.some((k) => !!a[k]) || (a.who?.length ?? 0) > 0 || !!mapsLink(a as Activity);
}

/**
 * An itinerary entry. Collapsed it's a one-line summary; expanded it shows the details.
 * Editors change it right in the card: the summary fields up top, the optional details
 * behind “More details”.
 */
export function ActivityCard({
  activity,
  people = [],
  tripId,
  readOnly,
  compact,
  expanded: expandedProp,
  onExpandedChange,
  defaultExpanded = true,
  startEditing,
  onSave,
  onCancelNew,
  onDelete,
  onToggleConfirmed,
  showStatus = true,
}: {
  activity: Activity | BookingDraft;
  people?: TripPerson[];
  tripId?: string;
  readOnly?: boolean;
  /** Leave out notes (used in votes). */
  compact?: boolean;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  defaultExpanded?: boolean;
  /** Open straight into editing (a brand-new entry). */
  startEditing?: boolean;
  onSave?: (a: BookingDraft) => void;
  /** Cancel on a brand-new entry that was never saved. */
  onCancelNew?: () => void;
  onDelete?: () => void;
  /** Flip Confirmed/Planning straight from the card (editors only). */
  onToggleConfirmed?: (confirmed: boolean) => void;
  /** Show the Confirmed/Planning marker (off for vote options). */
  showStatus?: boolean;
}) {
  const [ownExpanded, setOwnExpanded] = useState(defaultExpanded);
  const expanded = expandedProp ?? ownExpanded;
  const setExpanded = (open: boolean) => (onExpandedChange ? onExpandedChange(open) : setOwnExpanded(open));

  const [editing, setEditing] = useState(!!startEditing);
  const [draft, setDraft] = useState<BookingDraft>(() => ({ ...activity, type: normalizeType(activity.type) }));
  const [moreOpen, setMoreOpen] = useState(false);
  const set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const a: BookingDraft = { ...activity, type: normalizeType(activity.type) };
  const type = a.type;
  const Icon = BOOKING_ICONS[type];
  const meta = ACTIVITY_META[type];
  const time = [formatTime(a.startTime), formatTime(a.endTime)].filter(Boolean).join(" – ");
  const line = summaryLine(a);
  const details = hasDetails(a);
  const directions = mapsLink(a as Activity);
  const confirmed = !!a.confirmed;

  const beginEdit = () => {
    setDraft({ ...activity, type: normalizeType(activity.type) });
    setMoreOpen(false);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    if (startEditing && !("id" in activity && activity.id)) onCancelNew?.();
  };
  const save = () => {
    if (!draft.title.trim()) return;
    onSave?.(prepareForSave(draft));
    setEditing(false);
  };

  if (editing && !readOnly) {
    return (
      <div
        className="rounded-xl border-2 border-primary/40 bg-card p-3.5 shadow-sm sm:p-4"
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
      >
        <BookingSummaryFields draft={draft} set={set} autoFocus={startEditing} />

        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          {moreOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          More details
          <span className="font-normal text-muted-foreground">— who, confirmation, cost, notes…</span>
        </button>
        {moreOpen && (
          <div className="mt-3 rounded-lg border bg-secondary/30 p-3">
            <BookingDetailFields draft={draft} set={set} people={people} tripId={tripId} />
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 border-t pt-3">
          {onDelete && "id" in activity && activity.id && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!draft.title.trim()}>
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md ${
        showStatus && !confirmed ? "border-dashed border-muted-foreground/40" : ""
      }`}
    >
      <div className="flex items-start gap-2 p-2.5 sm:gap-3 sm:p-3">
        <button
          type="button"
          onClick={() => details && setExpanded(!expanded)}
          aria-expanded={details ? expanded : undefined}
          aria-label={details ? (expanded ? "Hide details" : "Show details") : undefined}
          disabled={!details}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left sm:gap-3"
        >
          <span className={`mt-0.5 flex h-5 w-4 shrink-0 items-center justify-center text-muted-foreground ${details ? "" : "invisible"}`}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.fg}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-serif text-base font-medium leading-snug text-foreground sm:text-lg">{a.title}</span>
              {time && (
                <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  <Clock className="h-3 w-3" /> {time}
                </span>
              )}
            </span>
            {line && <span className="mt-0.5 block truncate text-sm text-muted-foreground">{line}</span>}
          </span>
        </button>

        {showStatus && (
          <div className="flex shrink-0 items-center self-center">
            <ConfirmedToggle
              size="sm"
              checked={confirmed}
              onChange={!readOnly && onToggleConfirmed ? onToggleConfirmed : undefined}
            />
          </div>
        )}

        {!readOnly && onSave && (
          <div className="flex shrink-0 gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={beginEdit} aria-label={`Edit ${a.title}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onDelete}
                aria-label={`Delete ${a.title}`}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {details && expanded && (
        <div className="space-y-1 border-t px-3 pb-3 pt-2.5 text-sm text-foreground/80 sm:pl-[4.25rem]">
          {type === "airfare" && (a.duration || a.terminal || a.seats) && (
            <p className="text-muted-foreground">
              {[a.duration && `Flight time ${a.duration}`, a.terminal && `Terminal ${a.terminal}`, a.seats && `Seats ${a.seats}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {type === "transportation" && (a.provider || a.duration) && (
            <p className="text-muted-foreground">{[a.provider, a.duration].filter(Boolean).join(" · ")}</p>
          )}
          {(type === "hotel" || type === "meal") && a.address && (
            <p className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" /> {a.address}
            </p>
          )}
          {type === "hotel" && (a.roomType || a.guests) && (
            <p className="text-muted-foreground">
              {[a.roomType, a.guests && `${a.guests} guests`].filter(Boolean).join(" · ")}
            </p>
          )}
          {type === "meal" && a.guests && <p className="text-muted-foreground">Party of {a.guests}</p>}
          {type === "activity" && (a.meetingPoint || a.tickets) && (
            <p className="text-muted-foreground">
              {[a.meetingPoint && `Meet: ${a.meetingPoint}`, a.tickets && `Tickets: ${a.tickets}`].filter(Boolean).join(" · ")}
            </p>
          )}

          <WhoBadges who={a.who} people={people} />

          {(a.confirmation || a.cost || a.url || directions) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {a.confirmation && <span>Conf. {a.confirmation}</span>}
              {a.cost && <span>{a.cost}</span>}
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
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-8 items-center gap-1 font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Website
                </a>
              )}
            </div>
          )}

          {a.notes && !compact && <p className="whitespace-pre-wrap text-muted-foreground">{a.notes}</p>}
        </div>
      )}
    </div>
  );
}
