import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTrips } from "./use-trips";
import type { ImportPlan, TripFile } from "./trip-import";
import { daysBetween, todayIso, type Trip } from "./trips";

/** Create a whole trip — details, bookings, people and votes — from an import plan. */
export function useImportTrip() {
  const { createTrip, refresh } = useTrips();

  return useCallback(
    async (plan: ImportPlan): Promise<Trip> => {
      const trip = await createTrip({ ...plan.trip, activities: plan.activities });

      const memberIds = [...new Set(plan.people.map((p) => p.member?.id).filter((x): x is string => !!x))];
      if (memberIds.length) {
        const { error } = await supabase
          .from("trip_members")
          .upsert(
            memberIds.map((id) => ({ trip_id: trip.id, member_id: id, can_edit: false })),
            { onConflict: "trip_id,member_id", ignoreDuplicates: true },
          );
        if (error) throw new Error(`Trip created, but adding people failed: ${error.message}`);
      }

      for (const v of plan.votes) {
        const { data, error } = await supabase
          .from("polls")
          .insert({ trip_id: trip.id, question: v.question, day_index: v.dayIndex })
          .select("id")
          .single();
        if (error) throw new Error(`Trip created, but a vote failed: ${error.message}`);
        const { error: optError } = await supabase
          .from("poll_options")
          .insert(v.options.map((activity, i) => ({ poll_id: data.id, activity, sort: i })));
        if (optError) throw new Error(`Trip created, but a vote’s options failed: ${optError.message}`);
      }

      refresh();
      return trip;
    },
    [createTrip, refresh],
  );
}

/** Turn a trip back into a trip file (dates + first names), e.g. to reuse it or refine it in a chat with Claude. */
export function tripToFile(trip: Trip): TripFile {
  const days = daysBetween(trip.startDate, trip.endDate);
  const nameOf = (id: string) => trip.people.find((p) => p.memberId === id)?.name.split(/\s+/)[0];
  return {
    format: "w2ander-trip",
    version: 1,
    trip: {
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      coverEmoji: trip.coverEmoji,
    },
    people: trip.people.map((p) => p.name),
    bookings: trip.activities.map(({ id, dayIndex, who, lat, lng, geocodedFrom, ...rest }) => ({
      ...rest,
      date: days[dayIndex] ? todayIso(days[dayIndex]!) : undefined,
      who: who?.map(nameOf).filter((n): n is string => !!n),
    })),
  };
}

export function downloadTripFile(trip: Trip) {
  const blob = new Blob([JSON.stringify(tripToFile(trip), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${trip.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "trip"}.w2ander.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
