// Whole-trip calendar: one column per day, a hotel row, then half-hour rows with
// each entry drawn as a colored block from its start to its end time.
import { useMemo } from "react";
import type { Activity, ActivityType, Trip } from "@/lib/trips";
import {
  ACTIVITY_META,
  BOOKING_TYPES,
  daysBetween,
  durationToMinutes,
  formatTime,
  hotelNights,
  normalizeType,
  timeToMinutes,
  todayIso,
} from "@/lib/trips";
import { BOOKING_ICONS } from "./booking-icons";

const SLOT = 22; // px per half hour
const DEFAULT_MINUTES = 60;

type Placed = { a: Activity; type: ActivityType; start: number; end: number; lane: number; lanes: number };

function blockEnd(a: Activity, start: number): number {
  const end = timeToMinutes(a.endTime);
  if (end != null && end > start) return end;
  if (end != null && end <= start) return 24 * 60; // overnight: run to the end of the day
  const d = durationToMinutes(a.duration);
  return Math.min(24 * 60, start + (d && d > 0 ? d : DEFAULT_MINUTES));
}

/** Side-by-side lanes for entries that overlap. */
function layDay(items: Omit<Placed, "lane" | "lanes">[]): Placed[] {
  const sorted = [...items].sort((x, y) => x.start - y.start || y.end - x.end);
  const out: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = -1;
  const close = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    group.forEach((g) => (g.lanes = lanes));
    out.push(...group);
    group = [];
  };
  for (const it of sorted) {
    if (group.length && it.start >= groupEnd) close();
    const used = new Set(group.filter((g) => g.end > it.start).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ ...it, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, it.end);
  }
  if (group.length) close();
  return out;
}

export function TripCalendar({ trip, onSelect }: { trip: Trip; onSelect?: (a: Activity) => void }) {
  const days = useMemo(() => daysBetween(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const nights = useMemo(() => hotelNights(trip), [trip]);
  const today = todayIso();

  const { perDay, untimed, firstHour, lastHour } = useMemo(() => {
    const perDay: Placed[][] = days.map(() => []);
    const untimed: Activity[][] = days.map(() => []);
    let lo = 8 * 60;
    let hi = 22 * 60;
    const raw: Omit<Placed, "lane" | "lanes">[][] = days.map(() => []);
    for (const a of trip.activities) {
      if (a.dayIndex < 0 || a.dayIndex >= days.length) continue;
      const type = normalizeType(a.type);
      if (type === "hotel") continue; // shown in the hotel row
      const start = timeToMinutes(a.startTime);
      if (start == null) {
        untimed[a.dayIndex]!.push(a);
        continue;
      }
      const end = blockEnd(a, start);
      lo = Math.min(lo, start);
      hi = Math.max(hi, end);
      raw[a.dayIndex]!.push({ a, type, start, end });
    }
    raw.forEach((items, i) => (perDay[i] = layDay(items)));
    return { perDay, untimed, firstHour: Math.floor(lo / 60), lastHour: Math.min(24, Math.ceil(hi / 60)) };
  }, [trip.activities, days]);

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-muted-foreground">
        Add trip dates to see the calendar.
      </div>
    );
  }

  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const gridHeight = hours.length * 2 * SLOT;
  const top = (mins: number) => ((mins - firstHour * 60) / 30) * SLOT;
  const anyUntimed = untimed.some((u) => u.length > 0);
  const cols = `3.5rem repeat(${days.length}, minmax(8.5rem, 1fr))`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {BOOKING_TYPES.map((t) => {
          const Icon = BOOKING_ICONS[t];
          return (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={`inline-flex h-4 w-4 items-center justify-center rounded ${ACTIVITY_META[t].bg} ${ACTIVITY_META[t].fg}`}>
                <Icon className="h-2.5 w-2.5" />
              </span>
              {ACTIVITY_META[t].plural}
            </span>
          );
        })}
      </div>

      <div className="max-h-[75vh] overflow-auto rounded-xl border bg-card shadow-sm">
        <div className="grid min-w-max text-xs" style={{ gridTemplateColumns: cols }}>
          {/* Day headers */}
          <div className="sticky left-0 top-0 z-30 border-b border-r bg-card" />
          {days.map((d, i) => {
            const isToday = todayIso(d) === today;
            return (
              <div
                key={i}
                className={`sticky top-0 z-20 border-b border-r px-2 py-2 text-center last:border-r-0 ${isToday ? "bg-primary/10" : "bg-card"}`}
              >
                <div className="font-semibold text-foreground">{d.toLocaleDateString(undefined, { weekday: "long" })}</div>
                <div className="text-muted-foreground">
                  {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · Day {i + 1}
                </div>
              </div>
            );
          })}

          {/* Where we sleep */}
          <div className="sticky left-0 z-10 flex items-center border-b border-r bg-card px-1.5 py-1.5 font-medium text-muted-foreground">
            Hotel
          </div>
          {days.map((_, i) => {
            const h = nights[i];
            const flying = !h && trip.activities.some((a) => a.dayIndex === i && normalizeType(a.type) === "airfare");
            return (
              <div key={i} className="border-b border-r px-1 py-1 last:border-r-0">
                {h ? (
                  <button
                    type="button"
                    onClick={() => onSelect?.(h)}
                    className={`w-full truncate rounded px-1.5 py-1 text-left font-medium ${ACTIVITY_META.hotel.bg} ${ACTIVITY_META.hotel.fg}`}
                    title={h.title}
                  >
                    {h.title}
                  </button>
                ) : (
                  <span className="block px-1.5 py-1 text-muted-foreground">{flying ? "Flight" : i === days.length - 1 ? "" : "—"}</span>
                )}
              </div>
            );
          })}

          {/* Anytime that day */}
          {anyUntimed && (
            <>
              <div className="sticky left-0 z-10 border-b border-r bg-card px-1.5 py-1.5 font-medium text-muted-foreground">Anytime</div>
              {days.map((_, i) => (
                <div key={i} className="space-y-1 border-b border-r p-1 last:border-r-0">
                  {untimed[i]!.map((a) => {
                    const t = normalizeType(a.type);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onSelect?.(a)}
                        className={`block w-full truncate rounded px-1.5 py-1 text-left font-medium ${ACTIVITY_META[t].bg} ${ACTIVITY_META[t].fg}`}
                        title={a.title}
                      >
                        {a.title}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* Time column */}
          <div className="sticky left-0 z-10 border-r bg-card" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div key={h} className="relative pr-1.5 text-right text-[11px] text-muted-foreground" style={{ height: SLOT * 2 }}>
                <span className="relative -top-1.5">{formatTime(`${String(h).padStart(2, "0")}:00`)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((_, i) => (
            <div key={i} className="relative border-r last:border-r-0" style={{ height: gridHeight }}>
              {hours.map((h) => (
                <div key={h} className="border-b border-border/70" style={{ height: SLOT * 2 }}>
                  <div className="border-b border-dashed border-border/40" style={{ height: SLOT }} />
                </div>
              ))}
              {perDay[i]!.map((p) => {
                const Icon = BOOKING_ICONS[p.type];
                const height = Math.max(SLOT, top(p.end) - top(p.start)) - 2;
                const sub =
                  p.type === "airfare"
                    ? [p.a.from && p.a.to ? `${p.a.from} → ${p.a.to}` : "", p.a.airline].filter(Boolean).join(" · ")
                    : p.type === "transportation"
                      ? [p.a.mode, p.a.dropoff && `to ${p.a.dropoff}`].filter(Boolean).join(" ")
                      : p.a.location || "";
                return (
                  <button
                    key={p.a.id}
                    type="button"
                    onClick={() => onSelect?.(p.a)}
                    title={`${formatTime(p.a.startTime)} ${p.a.title}`}
                    className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-left leading-tight shadow-sm ring-1 ring-black/5 transition-[filter] hover:brightness-110 ${ACTIVITY_META[p.type].bg} ${ACTIVITY_META[p.type].fg}`}
                    style={{
                      top: top(p.start) + 1,
                      height,
                      left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / p.lanes}% - 4px)`,
                    }}
                  >
                    <span className="flex items-center gap-1 font-semibold">
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{p.a.title}</span>
                    </span>
                    {height > SLOT && (
                      <span className="block truncate opacity-85">
                        {formatTime(p.a.startTime)}
                        {p.a.endTime ? `–${formatTime(p.a.endTime)}` : ""}
                      </span>
                    )}
                    {height > SLOT * 2 && sub && <span className="block truncate opacity-85">{sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Tap an entry to open it in the itinerary.</p>
    </div>
  );
}
