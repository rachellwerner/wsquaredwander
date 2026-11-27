// The fields for one itinerary entry, split into the always-visible summary
// and the optional details. Used by the inline card editor and the vote-option dialog.
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WhoChips } from "@/components/WhoChips";
import { BOOKING_ICONS } from "@/components/booking-icons";
import type { Activity, ActivityType, TripPerson } from "@/lib/trips";
import { ACTIVITY_META, BOOKING_TYPES, placeQuery } from "@/lib/trips";

export type BookingDraft = Omit<Activity, "id"> & { id?: string };
type Setter = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => void;

const TITLE_PLACEHOLDER: Record<ActivityType, string> = {
  airfare: "Flight to Dublin",
  transportation: "Drive to Kenmare",
  hotel: "The Shelbourne",
  meal: "Dinner at Chapter One",
  activity: "Guinness Storehouse",
};

const TIME_LABELS: Record<ActivityType, [string, string]> = {
  airfare: ["Departs", "Arrives"],
  transportation: ["Departs", "Arrives"],
  hotel: ["Check-in time", "Check-out time"],
  meal: ["Reservation", "Until"],
  activity: ["Starts", "Ends"],
};

const TRANSPORT_MODES = ["Rental car", "Train", "Private transfer", "Taxi / rideshare", "Bus", "Ferry", "Metro"];
const MEAL_KINDS = ["Breakfast", "Brunch", "Lunch", "Dinner", "Drinks", "Café / snack"];
const ACTIVITY_KINDS = ["Museum", "Tour", "Tasting", "Sightseeing", "Outdoors", "Show", "Spa", "Shopping", "Other"];

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Text({
  draft,
  set,
  k,
  label,
  placeholder,
  className,
  type = "text",
}: {
  draft: BookingDraft;
  set: Setter;
  k: keyof BookingDraft;
  label: string;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Input
        type={type}
        value={(draft[k] as string | undefined) ?? ""}
        onChange={(e) => set(k, e.target.value as never)}
        placeholder={placeholder}
      />
    </Field>
  );
}

function Pick({
  draft,
  set,
  k,
  label,
  options,
  placeholder,
  className,
}: {
  draft: BookingDraft;
  set: Setter;
  k: keyof BookingDraft;
  label: string;
  options: string[];
  placeholder: string;
  className?: string;
}) {
  const value = (draft[k] as string | undefined) ?? "";
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Field label={label} className={className}>
      <Select value={value} onValueChange={(v) => set(k, v as never)}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {all.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Row of five icon buttons for choosing the kind of entry. */
export function TypePicker({ value, onChange }: { value: ActivityType; onChange: (t: ActivityType) => void }) {
  return (
    <div role="radiogroup" aria-label="Kind of entry" className="flex flex-wrap gap-1.5">
      {BOOKING_TYPES.map((t) => {
        const Icon = BOOKING_ICONS[t];
        const on = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
              on ? `${ACTIVITY_META[t].bg} ${ACTIVITY_META[t].fg} border-transparent` : "bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {ACTIVITY_META[t].label}
          </button>
        );
      })}
    </div>
  );
}

/** What you need to know at a glance: kind, name, times and where. */
export function BookingSummaryFields({ draft, set, autoFocus }: { draft: BookingDraft; set: Setter; autoFocus?: boolean }) {
  const [startLabel, endLabel] = TIME_LABELS[draft.type];
  return (
    <div className="space-y-3">
      <TypePicker value={draft.type} onChange={(t) => set("type", t)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Field label="Title" className="col-span-2 sm:col-span-4">
          <Input
            autoFocus={autoFocus}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={TITLE_PLACEHOLDER[draft.type]}
          />
        </Field>
        <Text draft={draft} set={set} k="startTime" label={startLabel} type="time" />
        <Text draft={draft} set={set} k="endTime" label={endLabel} type="time" />
      </div>

      {draft.type === "airfare" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Text draft={draft} set={set} k="from" label="From" placeholder="IAH" />
          <Text draft={draft} set={set} k="to" label="To" placeholder="DUB" />
          <Text draft={draft} set={set} k="airline" label="Airline" placeholder="United" />
          <Text draft={draft} set={set} k="flightNumber" label="Flight #" placeholder="UA 23" />
        </div>
      )}
      {draft.type === "transportation" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Pick draft={draft} set={set} k="mode" label="Mode" options={TRANSPORT_MODES} placeholder="Car, train…" className="col-span-2 sm:col-span-1" />
          <Text draft={draft} set={set} k="pickup" label="From" placeholder="Dublin Airport" />
          <Text draft={draft} set={set} k="dropoff" label="To" placeholder="Kenmare" />
        </div>
      )}
      {draft.type === "hotel" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Text draft={draft} set={set} k="checkIn" label="Check-in" type="date" />
          <Text draft={draft} set={set} k="checkOut" label="Check-out" type="date" />
          <Text draft={draft} set={set} k="address" label="Address" placeholder="27 St Stephen's Green, Dublin" className="col-span-2" />
        </div>
      )}
      {draft.type === "meal" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Pick draft={draft} set={set} k="category" label="Meal" options={MEAL_KINDS} placeholder="Dinner…" />
          <Text draft={draft} set={set} k="location" label="Restaurant / address" placeholder="Chapter One, Dublin" className="sm:col-span-2" />
        </div>
      )}
      {draft.type === "activity" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Pick draft={draft} set={set} k="category" label="Kind" options={ACTIVITY_KINDS} placeholder="Museum, tour…" />
          <Text draft={draft} set={set} k="location" label="Location" placeholder="St James's Gate, Dublin" className="sm:col-span-2" />
        </div>
      )}
    </div>
  );
}

/** Everything optional: who, confirmation, cost, links, notes and type-specific extras. */
export function BookingDetailFields({
  draft,
  set,
  people,
  tripId,
}: {
  draft: BookingDraft;
  set: Setter;
  people: TripPerson[];
  tripId?: string;
}) {
  return (
    <div className="space-y-3">
      {draft.type === "airfare" && (
        <div className="grid grid-cols-3 gap-3">
          <Text draft={draft} set={set} k="duration" label="Duration" placeholder="9h 10m" />
          <Text draft={draft} set={set} k="terminal" label="Terminal / gate" placeholder="T2 · B22" />
          <Text draft={draft} set={set} k="seats" label="Seats" placeholder="12A–12D" />
        </div>
      )}
      {draft.type === "transportation" && (
        <div className="grid grid-cols-2 gap-3">
          <Text draft={draft} set={set} k="provider" label="Company" placeholder="Hertz, Irish Rail…" />
          <Text draft={draft} set={set} k="duration" label="Duration" placeholder="3h 30m" />
        </div>
      )}
      {draft.type === "hotel" && (
        <div className="grid grid-cols-2 gap-3">
          <Text draft={draft} set={set} k="roomType" label="Rooms" placeholder="2 king rooms" />
          <Text draft={draft} set={set} k="guests" label="Guests" placeholder="4" />
        </div>
      )}
      {draft.type === "meal" && (
        <div className="grid grid-cols-2 gap-3">
          <Text draft={draft} set={set} k="guests" label="Party size" placeholder="6" />
          <Text draft={draft} set={set} k="address" label="Address" placeholder="18 Parnell Square" />
        </div>
      )}
      {draft.type === "activity" && (
        <div className="grid grid-cols-2 gap-3">
          <Text draft={draft} set={set} k="meetingPoint" label="Meeting point" placeholder="Main entrance" />
          <Text draft={draft} set={set} k="tickets" label="Tickets" placeholder="4 adult" />
        </div>
      )}

      <WhoChips people={people} tripId={tripId} value={draft.who ?? []} onChange={(next) => set("who", next)} />

      <div className="grid grid-cols-2 gap-3">
        <Text draft={draft} set={set} k="confirmation" label="Confirmation #" placeholder="ABC123" />
        <Text draft={draft} set={set} k="cost" label="Cost" placeholder="$240" />
      </div>
      <Text draft={draft} set={set} k="url" label="Website / booking link" type="url" placeholder="https://…" />
      <Field label="Notes">
        <Textarea
          value={draft.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Tips, what to bring…"
          rows={3}
        />
      </Field>
    </div>
  );
}

/** Trim, drop empty fields, and forget an old map pin if the place changed. */
export function prepareForSave<T extends BookingDraft>(draft: T): T {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(draft)) {
    const val = typeof v === "string" ? v.trim() : v;
    if (val === "" || val === undefined) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    next[k] = val;
  }
  const out = next as T;
  if (out.geocodedFrom !== undefined && placeQuery(out as unknown as Activity) !== out.geocodedFrom) {
    delete out.lat;
    delete out.lng;
    delete out.geocodedFrom;
  }
  return out;
}
