import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "lucide-react";
import type { Activity } from "@/lib/trips";
import { ACTIVITY_META, mapsLink, normalizeType, placeQuery } from "@/lib/trips";
import { geocodePlace } from "@/lib/geocode.functions";

const PIN_COLORS: Record<string, string> = {
  airfare: "var(--airfare)",
  hotel: "var(--hotel)",
  transportation: "var(--transportation)",
  meal: "var(--meal)",
  activity: "var(--activity)",
};

function pinIcon(n: number, type: string) {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:${PIN_COLORS[type] ?? "var(--primary)"};color:#1f2a24;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:600 13px Inter,system-ui,sans-serif">${n}</div>`,
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0]!, 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/**
 * Map of bookings with numbered pins (numbers match the order in the list).
 * Bookings without coordinates are looked up once; when `onPinned` is given,
 * the found coordinates are saved back onto the booking.
 */
export default function TripMap({
  activities,
  near,
  onPinned,
  className = "h-72",
}: {
  activities: Activity[];
  near?: string;
  onPinned?: (a: Activity) => void;
  className?: string;
}) {
  const geocode = useServerFn(geocodePlace);
  const [found, setFound] = useState<Record<string, { lat: number; lng: number } | null>>({});
  const [looking, setLooking] = useState(false);
  const started = useRef(new Set<string>());

  // Look up missing pins one at a time (free map service asks for ≤1/sec).
  useEffect(() => {
    let cancelled = false;
    const todo = activities.filter(
      (a) => a.lat == null && placeQuery(a) && !started.current.has(a.id),
    );
    if (todo.length === 0) return;
    (async () => {
      setLooking(true);
      for (const a of todo) {
        if (cancelled) break;
        started.current.add(a.id);
        const q = placeQuery(a);
        try {
          const hit = await geocode({ data: { q, near } });
          if (cancelled) break;
          setFound((f) => ({ ...f, [a.id]: hit }));
          if (hit && onPinned) onPinned({ ...a, lat: hit.lat, lng: hit.lng, geocodedFrom: q });
        } catch {
          setFound((f) => ({ ...f, [a.id]: null }));
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
      if (!cancelled) setLooking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities.map((a) => `${a.id}:${a.lat ?? ""}:${placeQuery(a)}`).join("|")]);

  const pins = useMemo(
    () =>
      activities
        .map((a, i) => {
          const pos = a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : found[a.id];
          return pos ? { a, n: i + 1, pos } : null;
        })
        .filter((p): p is NonNullable<typeof p> => !!p),
    [activities, found],
  );
  const missing = activities.filter((a) => !placeQuery(a) && a.lat == null).length;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className={`relative isolate ${className}`}>
        <MapContainer
          center={[53.35, -6.26]}
          zoom={5}
          scrollWheelZoom={false}
          className="h-full w-full"
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={pins.map((p) => [p.pos.lat, p.pos.lng])} />
          {pins.map(({ a, n, pos }) => {
            const link = mapsLink(a);
            return (
              <Marker key={a.id} position={[pos.lat, pos.lng]} icon={pinIcon(n, normalizeType(a.type))}>
                <Popup>
                  <div className="text-sm">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {ACTIVITY_META[normalizeType(a.type)].label}
                      {a.startTime ? ` · ${a.startTime}` : ""}
                    </div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{placeQuery(a)}</div>
                    {link && (
                      <a href={link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium">
                        <Navigation className="h-3 w-3" /> Directions
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        {pins.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-card/70 p-6 text-center text-sm text-muted-foreground">
            {looking ? "Finding places on the map…" : "Add an address or location to bookings to see them here."}
          </div>
        )}
      </div>
      {(looking || missing > 0) && pins.length > 0 && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {looking ? "Finding the rest of the places…" : `${missing} booking${missing === 1 ? "" : "s"} without an address aren’t shown.`}
        </p>
      )}
    </div>
  );
}
