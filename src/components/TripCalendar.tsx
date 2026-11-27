// Whole-trip calendar: a column per day, a "Stay" row with one bar per hotel stay,
// an "Anytime" row for untimed entries, then an hourly grid where each entry is a
// soft block from its start to its end time. "Full screen" (in Comfortable spacing)
// fits every day across the screen so nothing scrolls sideways.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { Activity, ActivityType, Trip } from "@/lib/trips";
import {
  ACTIVITY_META,
  BOOKING_TYPES,
  daysBetween,
  durationToMinutes,
  formatShortDate,
  formatTime,
  hotelNights,
  normalizeType,
  timeToMinutes,
  todayIso,
} from "@/lib/trips";
import { BOOKING_ICONS } from "./booking-icons";

type Density = "compact" | "comfy";
const GUTTER = 64; // px, time column
const MIN_FULL_COL = 84; // narrowest day column in full screen
const DEFAULT_MINUTES = 60;
const DENSITY_KEY = "w2ander:calendar-density";

const SIZES: Record<Density, { col: number; hour: number }> = {
  compact: { col: 128, hour: 40 },
  comfy: { col: 150, hour: 56 },
};

/** Soft tinted background for a type (stronger in dark mode via --cal-tint). */
const tint = (t: ActivityType, mix = "var(--cal-tint)") => `color-mix(in oklch, var(--${t}) ${mix}, var(--card))`;
const ink = (t: ActivityType) => `color-mix(in oklch, var(--${t}) 72%, var(--foreground))`;
const dashed = (t: ActivityType): CSSProperties => ({
  outline: `1.5px dashed color-mix(in oklch, var(--${t}) 55%, transparent)`,
  outlineOffset: "-1.5px",
});

type Placed = { a: Activity; type: ActivityType; start: number; end: number; lane: number };
type Stay = { from: number; nights: number; hotel: Activity | null };

function blockEnd(a: Activity, start: number): number {
  const end = timeToMinutes(a.endTime);
  if (end != null && end > start) return end;
  if (end != null && end <= start) return 24 * 60; // overnight: run to the end of the day
  const d = durationToMinutes(a.duration);
  return Math.min(24 * 60, start + (d && d > 0 ? d : DEFAULT_MINUTES));
}

/** Overlapping entries stack with a small offset so every title stays readable. */
function layDay(items: Omit<Placed, "lane">[]): Placed[] {
  const sorted = [...items].sort((x, y) => x.start - y.start || y.end - x.end);
  const out: Placed[] = [];
  for (const it of sorted) {
    const used = new Set(out.filter((o) => o.end > it.start).map((o) => o.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    out.push({ ...it, lane });
  }
  return out;
}

/** Consecutive nights at the same hotel become one bar; a hotel-less night with a flight is "In the air". */
function stayBars(trip: Trip, dayCount: number): Stay[] {
  const nights = hotelNights(trip);
  const bars: Stay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const h = nights[i] ?? null;
    const last = bars[bars.length - 1];
    if (h && last?.hotel?.id === h.id && last.from + last.nights === i) last.nights++;
    else if (h) bars.push({ from: i, nights: 1, hotel: h });
    else if (i < dayCount - 1 && trip.activities.some((a) => a.dayIndex === i && normalizeType(a.type) === "airfare"))
      bars.push({ from: i, nights: 1, hotel: null });
  }
  return bars;
}

function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfy";
  } catch {
    return "comfy";
  }
}

export function TripCalendar({ trip, onSelect }: { trip: Trip; onSelect?: (a: Activity) => void }) {
  const days = useMemo(() => daysBetween(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const [hidden, setHidden] = useState<Set<ActivityType>>(new Set());
  const [density, setDensityState] = useState<Density>("comfy");
  const [full, setFull] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0, top: 0 }); // full-screen measurements
  const [now, setNow] = useState<{ iso: string; mins: number } | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDensityState(readDensity());
    const tick = () => {
      const d = new Date();
      setNow({ iso: todayIso(d), mins: d.getHours() * 60 + d.getMinutes() });
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const setDensity = (d: Density) => {
    setDensityState(d);
    if (d === "compact") exitFull();
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      /* not saved; fine */
    }
  };

  // ---- full screen -------------------------------------------------------
  const measure = useCallback(() => {
    const sc = scrollRef.current;
    const col = firstColRef.current;
    if (sc && col) setBox({ w: sc.clientWidth, h: sc.clientHeight, top: col.offsetTop });
  }, []);

  const exitFull = useCallback(() => {
    setFull(false);
    if (typeof document !== "undefined" && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  /** Opening an entry leaves full screen first (it jumps to the Itinerary). */
  const select = (a: Activity) => {
    if (full) exitFull();
    onSelect?.(a);
  };

  const enterFull = () => {
    setFull(true);
    try {
      void shellRef.current?.requestFullscreen?.().catch(() => {});
    } catch {
      /* the overlay still covers the page */
    }
  };

  useEffect(() => {
    if (!full) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exitFull();
    const onFs = () => (document.fullscreenElement ? measure() : exitFull());
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [full, exitFull, measure]);

  useLayoutEffect(() => {
    if (full) measure();
  }, [full, measure, hidden]);

  // ---- layout data -------------------------------------------------------
  const { perDay, untimed, firstHour, lastHour } = useMemo(() => {
    const perDay: Placed[][] = days.map(() => []);
    const untimed: Activity[][] = days.map(() => []);
    let lo = 8 * 60;
    let hi = 22 * 60;
    const raw: Omit<Placed, "lane">[][] = days.map(() => []);
    for (const a of trip.activities) {
      if (a.dayIndex < 0 || a.dayIndex >= days.length) continue;
      const type = normalizeType(a.type);
      if (type === "hotel" || hidden.has(type)) continue; // hotels live in the Stay row
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
  }, [trip.activities, days, hidden]);

  const stays = useMemo(() => (hidden.has("hotel") ? [] : stayBars(trip, days.length)), [trip, days.length, hidden]);

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-muted-foreground">
        Add trip dates to see the calendar.
      </div>
    );
  }

  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const size = SIZES[density];
  const colw = full && box.w ? Math.max(MIN_FULL_COL, Math.floor((box.w - GUTTER) / days.length)) : size.col;
  const hourPx = full && box.h ? Math.max(30, Math.floor((box.h - box.top - 4) / hours.length)) : size.hour;
  const y = (mins: number) => ((mins - firstHour * 60) / 60) * hourPx;
  const anyUntimed = untimed.some((u) => u.length > 0);
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `${GUTTER}px repeat(${days.length}, minmax(${colw}px, 1fr))`,
    minWidth: GUTTER + days.length * colw,
  };
  const laneLabel = "sticky left-0 z-10 flex items-center justify-end bg-card pr-2 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

  const toggleType = (t: ActivityType) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const legend = (
    <div className="flex flex-wrap gap-1.5">
      {BOOKING_TYPES.map((t) => {
        const Icon = BOOKING_ICONS[t];
        const off = hidden.has(t);
        return (
          <button
            key={t}
            type="button"
            aria-pressed={!off}
            onClick={() => toggleType(t)}
            title={off ? `Show ${ACTIVITY_META[t].plural.toLowerCase()}` : `Hide ${ACTIVITY_META[t].plural.toLowerCase()}`}
            className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-opacity ${off ? "opacity-40" : ""}`}
            style={{ background: tint(t), color: ink(t) }}
          >
            <Icon className="h-3.5 w-3.5" /> {ACTIVITY_META[t].plural}
          </button>
        );
      })}
      <span className="inline-flex h-7 items-center rounded-full border-[1.5px] border-dashed border-muted-foreground/40 bg-card px-2.5 text-xs font-medium text-muted-foreground">
        Dashed = planning
      </span>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {legend}
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-[10px] bg-muted p-[3px] text-xs font-medium" role="group" aria-label="Spacing">
            {(
              [
                ["compact", "Compact"],
                ["comfy", "Comfortable"],
              ] as const
            ).map(([d, label]) => (
              <button
                key={d}
                type="button"
                aria-pressed={density === d}
                onClick={() => setDensity(d)}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  density === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {density === "comfy" && (
            <button
              type="button"
              onClick={enterFull}
              title="See every day at once"
              className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Full screen
            </button>
          )}
        </div>
      </div>

      <div
        ref={shellRef}
        className={
          full
            ? "fixed inset-0 z-50 flex flex-col bg-card"
            : "overflow-hidden rounded-[18px] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_30px_-12px_rgb(20_40_80/0.18)]"
        }
      >
        {full && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
            <div>
              <h2 className="font-serif text-lg font-medium leading-tight">{trip.title}</h2>
              <p className="text-xs text-muted-foreground">
                {formatShortDate(trip.startDate)} – {formatShortDate(trip.endDate)} · {days.length} days
              </p>
            </div>
            {legend}
            <button
              type="button"
              onClick={exitFull}
              title="Exit full screen (Esc)"
              className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border bg-card px-3 text-xs font-medium"
            >
              <Minimize2 className="h-3.5 w-3.5" /> Exit full screen
            </button>
          </div>
        )}

        <div
          ref={scrollRef}
          className={`overflow-auto overscroll-contain ${full ? "flex-1" : "max-h-[78vh] snap-x snap-proximity"}`}
          style={{ scrollPaddingLeft: GUTTER }}
        >
          <div className="relative grid text-xs" style={gridStyle}>
            {/* Day headers */}
            <div className="sticky left-0 top-0 z-30 bg-card" />
            {days.map((d, i) => {
              const isToday = now?.iso === todayIso(d);
              return (
                <div key={i} className={`sticky top-0 z-20 snap-start bg-card px-1 text-center ${full ? "pb-1.5 pt-2" : "pb-2.5 pt-3.5"}`}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </div>
                  <div
                    className={`mx-auto mt-1 grid place-items-center rounded-full font-serif font-medium leading-none ${
                      full ? "h-8 w-8 text-[19px]" : "h-[38px] w-[38px] text-[22px]"
                    } ${isToday ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {d.getDate()}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {d.toLocaleDateString(undefined, { month: "short" })} · Day {i + 1}
                  </div>
                </div>
              );
            })}
            <div className="col-span-full h-px bg-border" />

            {/* Where we sleep: one bar per stay */}
            <div className={laneLabel}>Stay</div>
            <div className="relative col-[2/-1] grid gap-y-1 py-1.5" style={{ gridTemplateColumns: "subgrid" }}>
              {stays.map((s) => {
                const h = s.hotel;
                const t: ActivityType = h ? "hotel" : "airfare";
                const Icon = BOOKING_ICONS[t];
                return (
                  <button
                    key={`${s.from}-${h?.id ?? "air"}`}
                    type="button"
                    disabled={!h}
                    onClick={() => h && select(h)}
                    title={h ? `${h.title} · ${s.nights} night${s.nights > 1 ? "s" : ""} · ${h.confirmed ? "Confirmed" : "Planning"}` : "In the air"}
                    className="mx-1 flex h-[30px] min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[9px] px-2.5 text-left text-xs font-semibold"
                    style={{
                      gridColumn: `${s.from + 1} / span ${s.nights}`,
                      color: ink(t),
                      ...(h && h.confirmed ? { background: tint(t) } : { background: "var(--card)", ...dashed(t) }),
                      ...(h ? {} : { fontWeight: 500 }),
                    }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {h ? h.title : "In the air"}
                      {h && (
                        <span className="font-medium opacity-70">
                          {" "}
                          · {s.nights} night{s.nights > 1 ? "s" : ""}
                          {h.confirmed ? "" : " · planning"}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Anytime that day */}
            {anyUntimed && (
              <>
                <div className={laneLabel}>Anytime</div>
                <div className="col-[2/-1] grid py-1.5" style={{ gridTemplateColumns: "subgrid" }}>
                  {days.map((_, i) => (
                    <div key={i} className="mx-1 min-w-0 space-y-1" style={{ gridColumn: i + 1 }}>
                      {untimed[i]!.map((a) => {
                        const t = normalizeType(a.type);
                        const Icon = BOOKING_ICONS[t];
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => select(a)}
                            title={`${a.title} · ${a.confirmed ? "Confirmed" : "Planning"}`}
                            className="flex h-[26px] w-full min-w-0 items-center gap-1.5 rounded-lg px-2 text-left text-xs font-medium"
                            style={{
                              color: ink(t),
                              ...(a.confirmed ? { background: tint(t) } : { background: "var(--card)", ...dashed(t) }),
                            }}
                          >
                            <Icon className="h-[13px] w-[13px] shrink-0" />
                            <span className="truncate">{a.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="col-span-full h-px bg-border" />

            {/* Time gutter */}
            <div className="sticky left-0 z-10 bg-card">
              {hours.map((h, i) => (
                <div key={h} className="relative" style={{ height: hourPx }}>
                  {i > 0 && (
                    <span className="absolute -top-[7px] right-2 whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
                      {formatTime(`${String(h).padStart(2, "0")}:00`)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d, i) => {
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = now?.iso === todayIso(d);
              return (
                <div
                  key={i}
                  ref={i === 0 ? firstColRef : undefined}
                  className={`relative border-l ${weekend ? "bg-muted/45" : ""}`}
                >
                  {hours.map((h, j) => (
                    <div key={h} className={j ? "border-t border-border/70" : ""} style={{ height: hourPx }} />
                  ))}

                  {perDay[i]!.map((p) => {
                    const Icon = BOOKING_ICONS[p.type];
                    const top = y(p.start) + 2;
                    const height = Math.max(26, y(p.end) - y(p.start) - 4);
                    const small = height < 44;
                    const sub =
                      p.type === "airfare"
                        ? [p.a.from && p.a.to ? `${p.a.from} → ${p.a.to}` : "", p.a.airline].filter(Boolean).join(" · ")
                        : p.type === "transportation"
                          ? [p.a.mode, p.a.dropoff && `to ${p.a.dropoff}`].filter(Boolean).join(" ")
                          : p.a.location || "";
                    const time = `${formatTime(p.a.startTime)}${p.end < 24 * 60 && p.a.endTime ? ` – ${formatTime(p.a.endTime)}` : p.end >= 24 * 60 ? " →" : ""}`;
                    return (
                      <button
                        key={p.a.id}
                        type="button"
                        onClick={() => select(p.a)}
                        title={`${time} · ${p.a.title} · ${p.a.confirmed ? "Confirmed" : "Planning"}`}
                        className={`absolute flex flex-col justify-start overflow-hidden rounded-[10px] pl-[11px] pr-2 text-left text-foreground transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md ${
                          small ? "py-[3px]" : "py-1.5"
                        }`}
                        style={{
                          top,
                          height,
                          left: 4 + p.lane * 22,
                          right: 4,
                          zIndex: 2 + p.lane,
                          background: p.a.confirmed ? tint(p.type) : tint(p.type, "5%"),
                          ...(p.a.confirmed ? {} : dashed(p.type)),
                          ...(p.lane ? { boxShadow: "0 0 0 2px var(--card)" } : {}),
                        }}
                      >
                        <span
                          aria-hidden
                          className="absolute bottom-[5px] left-[3px] top-[5px] w-[3px] rounded-[3px]"
                          style={{ background: `var(--${p.type})`, opacity: p.a.confirmed ? 1 : 0.45 }}
                        />
                        <span className={`flex min-w-0 items-center gap-1 font-semibold leading-tight ${small ? "text-[11.5px]" : "text-[12.5px]"}`}>
                          <Icon className="h-[13px] w-[13px] shrink-0" style={{ color: ink(p.type) }} />
                          <span className="truncate">{p.a.title}</span>
                        </span>
                        {!small && <span className="mt-0.5 truncate text-[11.5px] tabular-nums text-muted-foreground">{time}</span>}
                        {height > 70 && sub && <span className="truncate text-[11.5px] text-muted-foreground">{sub}</span>}
                        {!p.a.confirmed && height > 92 && (
                          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Planning</span>
                        )}
                      </button>
                    );
                  })}

                  {isToday && now && now.mins >= firstHour * 60 && now.mins <= lastHour * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-[1] h-0.5 bg-[var(--now)]" style={{ top: y(now.mins) }}>
                      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[var(--now)]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!full && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tap an entry to open it in the itinerary. Dashed = still planning.
          {density === "comfy" ? " Use Full screen to see every day at once." : ""}
        </p>
      )}
    </div>
  );
}
