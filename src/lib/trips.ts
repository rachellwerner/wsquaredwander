export type ActivityType = "airfare" | "hotel" | "transportation" | "activity";

// Legacy values from earlier versions
export function normalizeType(t: string | undefined): ActivityType {
  switch (t) {
    case "airfare":
    case "hotel":
    case "transportation":
    case "activity":
      return t;
    case "travel":
      return "transportation";
    case "experience":
      return "activity";
    default:
      return "activity";
  }
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
  category?: string; // museum, wine tasting, walking tour, food, other
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

export const ACTIVITY_META: Record<ActivityType, { label: string; bg: string; fg: string }> = {
  airfare: { label: "Airfare", bg: "bg-[var(--airfare)]", fg: "text-[var(--airfare-foreground)]" },
  hotel: { label: "Hotel", bg: "bg-[var(--hotel)]", fg: "text-[var(--hotel-foreground)]" },
  transportation: {
    label: "Transportation",
    bg: "bg-[var(--transportation)]",
    fg: "text-[var(--transportation-foreground)]",
  },
  activity: { label: "Activity", bg: "bg-[var(--activity)]", fg: "text-[var(--activity-foreground)]" },
};
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
