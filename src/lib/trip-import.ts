// W²ander trip file: a portable JSON description of a whole trip that can be
// written by hand, by Claude in a planning chat, or exported — then imported.
import { z } from "zod";
import type { Activity, ActivityType } from "./trips";
import { daysBetween, normalizeType, todayIso, uid } from "./trips";
import { firstName } from "./members";
import type { Member } from "./members";

const str = z.string().trim().max(1000).optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const time = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, "Use 24-hour HH:MM")
  .optional();

const bookingSchema = z
  .object({
    date: date.optional(), // which day it happens (hotels: check-in day)
    day: z.number().int().min(1).max(60).optional(), // or "day 3" instead of a date
    type: z.string().optional(), // airfare | hotel | transportation | activity
    title: z.string().trim().min(1).max(200),
    startTime: time,
    endTime: time,
    who: z.array(z.string().trim().max(80)).max(30).optional(), // first names, or "everyone"
    notes: str,
    url: str,
    confirmation: str,
    confirmed: z.boolean().optional(), // true = booked; leave out while still planning
    cost: str,
    // transport / flights
    mode: str,
    from: str,
    to: str,
    duration: str,
    airline: str,
    flightNumber: str,
    seats: str,
    terminal: str,
    provider: str,
    pickup: str,
    dropoff: str,
    // hotels
    hotelName: str,
    address: str,
    checkIn: date.optional(),
    checkOut: date.optional(),
    roomType: str,
    guests: str,
    // activities
    category: str,
    location: str,
    tickets: str,
    meetingPoint: str,
  })
  .passthrough();

export const tripFileSchema = z.object({
  format: z.literal("w2ander-trip").optional(),
  version: z.number().optional(),
  trip: z.object({
    title: z.string().trim().min(1).max(200),
    destination: z.string().trim().max(200).optional(),
    startDate: date,
    endDate: date,
    coverEmoji: z.string().max(8).optional(),
  }),
  people: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  bookings: z.array(bookingSchema).max(500).default([]),
  votes: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(300),
        date: date.optional(),
        day: z.number().int().min(1).max(60).optional(),
        options: z.array(bookingSchema).min(2).max(10),
      }),
    )
    .max(50)
    .optional(),
});

export type TripFile = z.infer<typeof tripFileSchema>;

export type ImportPlan = {
  trip: { title: string; destination: string; startDate: string; endDate: string; coverEmoji: string };
  activities: Activity[];
  votes: { question: string; dayIndex: number | null; options: Omit<Activity, "id">[] }[];
  people: { name: string; member: Member | null }[]; // name from the file → matched person
  warnings: string[];
};

const TYPES: ActivityType[] = ["airfare", "transportation", "hotel", "meal", "activity"];
const TYPE_ALIASES: Record<string, ActivityType> = {
  flight: "airfare",
  flights: "airfare",
  air: "airfare",
  lodging: "hotel",
  stay: "hotel",
  accommodation: "hotel",
  car: "transportation",
  "rental car": "transportation",
  train: "transportation",
  transfer: "transportation",
  drive: "transportation",
  transport: "transportation",
  tour: "activity",
  experience: "activity",
  meals: "meal",
  dining: "meal",
  dinner: "meal",
  lunch: "meal",
  breakfast: "meal",
  brunch: "meal",
  food: "meal",
  restaurant: "meal",
  drinks: "meal",
};

function toType(t: string | undefined): ActivityType {
  const k = (t ?? "").toLowerCase().trim();
  if (TYPES.includes(k as ActivityType)) return k as ActivityType;
  return TYPE_ALIASES[k] ?? normalizeType(k);
}

/** Parse JSON text (tolerates ```json fences and text around the JSON). */
export function parseTripFileText(text: string): TripFile {
  let raw = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fence) raw = fence[1]!.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("That doesn’t look like a trip file — no { … } found.");
  let json: unknown;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    throw new Error(`The file isn’t valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const result = tripFileSchema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(`Problem at “${first?.path.join(".") || "file"}”: ${first?.message ?? "invalid"}`);
  }
  return result.data;
}

/** Match names in the file to people already in W²ander, and lay bookings onto trip days. */
export function planImport(file: TripFile, members: Member[]): ImportPlan {
  const warnings: string[] = [];
  const days = daysBetween(file.trip.startDate, file.trip.endDate);
  if (days.length === 0) throw new Error("The trip’s end date is before its start date.");
  const dayIso = days.map((d) => todayIso(d));

  // People: explicit list, plus anyone named on a booking
  const named = new Set<string>(file.people ?? []);
  const allBookings = [...file.bookings, ...(file.votes ?? []).flatMap((v) => v.options)];
  allBookings.forEach((b) => b.who?.forEach((w) => !isEveryone(w) && named.add(w)));

  const match = (name: string): Member | null => {
    const n = name.toLowerCase().trim();
    return (
      members.find((m) => m.name.toLowerCase().trim() === n) ??
      members.find((m) => firstName(m.name).toLowerCase() === n) ??
      members.find((m) => m.email && m.email.toLowerCase() === n) ??
      null
    );
  };
  const people = [...named].map((name) => ({ name, member: match(name) }));
  const unmatched = people.filter((p) => !p.member).map((p) => p.name);
  if (unmatched.length) {
    warnings.push(
      `Not in People yet: ${unmatched.join(", ")}. Add them on the People page first if you want them on this trip — otherwise they’ll be left off bookings.`,
    );
  }
  const tripMemberIds = [...new Set(people.map((p) => p.member?.id).filter((x): x is string => !!x))];

  const resolveWho = (who: string[] | undefined): string[] | undefined => {
    if (!who || who.length === 0) return undefined;
    if (who.some(isEveryone)) return tripMemberIds;
    const ids = who.map((w) => match(w)?.id).filter((x): x is string => !!x);
    return ids.length ? [...new Set(ids)] : undefined;
  };

  const resolveDay = (b: { date?: string; day?: number; checkIn?: string; title: string }, label: string): number | null => {
    if (b.day) {
      if (b.day > days.length) warnings.push(`${label} “${b.title}” is on day ${b.day}, after the trip ends — put on the last day.`);
      return Math.min(b.day, days.length) - 1;
    }
    const d = b.date ?? b.checkIn;
    if (!d) return null;
    const i = dayIso.indexOf(d);
    if (i >= 0) return i;
    warnings.push(`${label} “${b.title}” is dated ${d}, outside the trip dates — put on the ${d < dayIso[0]! ? "first" : "last"} day.`);
    return d < dayIso[0]! ? 0 : days.length - 1;
  };

  const toActivity = (b: z.infer<typeof bookingSchema>, dayIndex: number): Omit<Activity, "id"> => {
    const { date: _d, day: _day, type, who, ...rest } = b;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined || v === null || v === "") continue;
      clean[k] = v;
    }
    const t = toType(type);
    return {
      ...(clean as Partial<Activity>),
      type: t,
      title: b.title,
      dayIndex,
      who: resolveWho(who),
      startTime: b.startTime ? b.startTime.padStart(5, "0") : undefined,
      endTime: b.endTime ? b.endTime.padStart(5, "0") : undefined,
      ...(t === "hotel" && !clean["hotelName"] ? { hotelName: b.title } : {}),
    } as Omit<Activity, "id">;
  };

  const activities: Activity[] = file.bookings.map((b) => {
    const dayIndex = resolveDay(b, "Booking");
    if (dayIndex === null) warnings.push(`Booking “${b.title}” has no date — put on day 1.`);
    return { ...toActivity(b, dayIndex ?? 0), id: uid() };
  });

  const votes = (file.votes ?? []).map((v) => {
    const dayIndex = resolveDay({ ...v, title: v.question }, "Vote");
    return {
      question: v.question,
      dayIndex,
      options: v.options.map((o) => toActivity(o, dayIndex ?? resolveDay(o, "Vote option") ?? 0)),
    };
  });

  return {
    trip: {
      title: file.trip.title,
      destination: file.trip.destination ?? "",
      startDate: file.trip.startDate,
      endDate: file.trip.endDate,
      coverEmoji: file.trip.coverEmoji || "✈️",
    },
    activities,
    votes,
    people,
    warnings,
  };
}

function isEveryone(w: string) {
  return /^(everyone|all|everybody|whole group|family)$/i.test(w.trim());
}
