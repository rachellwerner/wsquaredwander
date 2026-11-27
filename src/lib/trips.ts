export type ActivityType = "airfare" | "transportation" | "hotel" | "meal" | "activity";

/** The five kinds of entries, in the order they're shown in filters and pickers. */
export const BOOKING_TYPES: ActivityType[] = ["airfare", "transportation", "hotel", "meal", "activity"];

// Legacy values from earlier versions
export function normalizeType(t: string | undefined): ActivityType {
  switch (t) {
    case "airfare":
    case "hotel":
    case "transportation":
    case "meal":
    case "activity":
      return t;
    case "travel":
      return "transportation";
    case "meals":
    case "dining":
    case "food":
      return "meal";
    case "experience":
      return "activity";
    default:
      return "activity";
  }
}

/** Fix up a stored booking: known type, and old "Activity · Food" entries become meals. */
export function normalizeActivity<T extends { type?: string; category?: string; confirmed?: boolean; confirmation?: string }>(
  a: T,
): T & { type: ActivityType } {
  const type = normalizeType(a.type);
  // Entries saved before the Confirmed checkbox existed count as booked if they have a confirmation number.
  const confirmed = a.confirmed ?? (a.confirmation ? true : undefined);
  const base = confirmed === undefined ? a : { ...a, confirmed };
  if (type === "activity" && /^(food|dining|meal|restaurant)$/i.test(a.category ?? "")) {
    const { category: _old, ...rest } = base;
    return { ...(rest as T), type: "meal" };
  }
  return { ...base, type };
}

/** Place name used to give the map context ("Guinness Storehouse" near …). */
export function tripPlace(trip: Pick<Trip, "title" | "destination">) {
  return trip.destination || trip.title;
}

export type Activity = {
  id: string;
  dayIndex: number; // 0-based day within trip
  type: ActivityType;
  title: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  url?: string; // booking / website link
  confirmation?: string;
  cost?: string;
  who?: string[]; // member ids of the people on this booking
  confirmed?: boolean; // booked (true) vs. still planning
  // map pin (filled in automatically from address/location)
  lat?: number;
  lng?: number;
  geocodedFrom?: string;
  // shared travel
  mode?: string; // train, car, ferry, bus, transfer
  from?: string;
  to?: string;
  duration?: string;
  // airfare
  airline?: string;
  flightNumber?: string;
  seats?: string;
  terminal?: string;
  // transportation
  provider?: string;
  pickup?: string;
  dropoff?: string;
  // hotel
  hotelName?: string;
  address?: string;
  checkIn?: string; // ISO date
  checkOut?: string; // ISO date
  roomType?: string;
  guests?: string;
  // activity
  category?: string; // activity: museum, wine tasting…  ·  meal: breakfast, lunch, dinner…
  location?: string;
  tickets?: string;
  meetingPoint?: string;
};

export type TripPerson = {
  memberId: string;
  name: string;
  userId: string | null;
  canEdit: boolean;
};

export type Trip = {
  id: string;
  title: string;
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  coverEmoji?: string;
  activities: Activity[];
  people: TripPerson[];
};

/** Today's date in the traveler's local time, as YYYY-MM-DD. */
export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 0-based day index of `iso` within the trip, or -1 if outside it. */
export function dayIndexFor(trip: Pick<Trip, "startDate" | "endDate">, iso: string) {
  const days = daysBetween(trip.startDate, trip.endDate);
  return days.findIndex((d) => todayIso(d) === iso);
}

/** Text we can look up on a map for this booking. */
export function placeQuery(a: Activity): string {
  switch (normalizeType(a.type)) {
    case "hotel":
      return [a.hotelName, a.address].filter(Boolean).join(", ");
    case "transportation":
      return a.pickup ?? "";
    case "airfare":
      return a.from ? `${a.from} airport` : "";
    case "meal":
      return a.location || a.address || "";
    default:
      return a.location || a.meetingPoint || "";
  }
}

export function mapsLink(a: Activity): string | null {
  const q = placeQuery(a);
  if (!q && a.lat == null) return null;
  const query = a.lat != null && a.lng != null ? `${a.lat},${a.lng}` : q;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function daysBetween(startDate: string, endDate: string): Date[] {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const out: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function formatDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatShortDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function tripLengthDays(trip: Pick<Trip, "startDate" | "endDate">) {
  return daysBetween(trip.startDate, trip.endDate).length;
}

// Base64url encode/decode that works for unicode
function b64urlEncode(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeTripPayload(trip: Trip): string {
  return b64urlEncode(JSON.stringify(trip));
}

export function decodeTripPayload(payload: string): Trip | null {
  try {
    const json = b64urlDecode(payload);
    const parsed = JSON.parse(json) as Trip;
    if (!parsed || typeof parsed !== "object" || !parsed.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const ACTIVITY_META: Record<ActivityType, { label: string; plural: string; bg: string; fg: string }> = {
  airfare: { label: "Flight", plural: "Flights", bg: "bg-[var(--airfare)]", fg: "text-[var(--airfare-foreground)]" },
  transportation: {
    label: "Transportation",
    plural: "Transportation",
    bg: "bg-[var(--transportation)]",
    fg: "text-[var(--transportation-foreground)]",
  },
  hotel: { label: "Hotel", plural: "Hotels", bg: "bg-[var(--hotel)]", fg: "text-[var(--hotel-foreground)]" },
  meal: { label: "Meal", plural: "Meals", bg: "bg-[var(--meal)]", fg: "text-[var(--meal-foreground)]" },
  activity: { label: "Activity", plural: "Activities", bg: "bg-[var(--activity)]", fg: "text-[var(--activity-foreground)]" },
};

/** "HH:MM" → minutes after midnight, or null. */
export function timeToMinutes(t: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins <= 24 * 60 ? mins : null;
}

/** "8h 25m", "1h", "45m", "1:35" → minutes, or null. */
export function durationToMinutes(d: string | undefined): number | null {
  if (!d) return null;
  const hm = /^(\d{1,2}):(\d{2})$/.exec(d.trim());
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const h = /(\d+(?:\.\d+)?)\s*h/i.exec(d);
  const m = /(\d+)\s*m/i.exec(d);
  if (!h && !m) return null;
  return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
}

/** 24h "14:30" → "2:30 PM" in the viewer's locale. */
export function formatTime(t: string | undefined): string {
  const mins = timeToMinutes(t);
  if (mins == null) return t ?? "";
  const d = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Hotel for each night of the trip (index = day index; the night that starts that day).
 * Uses check-in/check-out when present, otherwise the day the hotel is on.
 */
export function hotelNights(trip: Pick<Trip, "startDate" | "endDate" | "activities">): (Activity | null)[] {
  const days = daysBetween(trip.startDate, trip.endDate).map((d) => todayIso(d));
  const out: (Activity | null)[] = days.map(() => null);
  for (const a of trip.activities) {
    if (normalizeType(a.type) !== "hotel") continue;
    if (a.checkIn && a.checkOut) {
      days.forEach((iso, i) => {
        if (iso >= a.checkIn! && iso < a.checkOut!) out[i] = a;
      });
    } else if (out[a.dayIndex] === null && a.dayIndex < out.length) {
      out[a.dayIndex] = a;
    }
  }
  return out;
}
/** Bookings in time order; untimed ones go last. */
export function sortActivities(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => {
    const at = a.startTime || "99:99";
    const bt = b.startTime || "99:99";
    return at.localeCompare(bt) || a.title.localeCompare(b.title);
  });
}

/** Copy of a trip that is safe to put in a public link (no confirmation #s, costs or names). */
export function publicCopy(trip: Trip): Trip {
  return {
    ...trip,
    people: [],
    activities: trip.activities.map(({ confirmation, cost, who, seats, ...rest }) => rest),
  };
}
