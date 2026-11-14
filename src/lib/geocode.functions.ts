import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Look up map coordinates for a place name using OpenStreetMap's free
 * Nominatim service. Results are saved onto the booking, so each place is
 * only looked up once. (Nominatim asks for ≤1 request/second and an
 * identifying User-Agent — the client spaces requests out.)
 */
export const geocodePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ q: z.string().min(2).max(300), near: z.string().max(200).optional() }).parse(input))
  .handler(async ({ data }) => {
    const tryQuery = async (q: string) => {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "W2ander family trip planner (https://wsquaredwander.com)",
          "Accept-Language": "en",
        },
      });
      if (!res.ok) return null;
      const list = (await res.json()) as { lat: string; lon: string }[];
      const hit = list[0];
      if (!hit) return null;
      return { lat: Number(hit.lat), lng: Number(hit.lon) };
    };
    // Try with the trip destination for context first ("Guinness Storehouse, Dublin"), then bare.
    const withContext = data.near ? await tryQuery(`${data.q}, ${data.near}`) : null;
    return withContext ?? (await tryQuery(data.q));
  });
