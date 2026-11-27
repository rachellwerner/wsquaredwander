import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeActivity, type Trip, type Activity, type TripPerson, uid } from "./trips";
import { useAuth } from "./use-auth";
import { useIsAdmin } from "./use-members";

type TripRow = {
  id: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  cover_emoji: string | null;
  activities: unknown;
  trip_members?: {
    member_id: string;
    can_edit: boolean;
    member: { id: string; name: string; user_id: string | null } | null;
  }[];
};

const TRIP_SELECT =
  "id,title,destination,start_date,end_date,cover_emoji,activities," +
  "trip_members(member_id,can_edit,member:members(id,name,user_id))";

export function rowToTrip(row: TripRow): Trip {
  const activities = Array.isArray(row.activities) ? (row.activities as Activity[]) : [];
  const people: TripPerson[] = (row.trip_members ?? [])
    .map((tm) => ({
      memberId: tm.member_id,
      name: tm.member?.name ?? "Someone",
      userId: tm.member?.user_id ?? null,
      canEdit: tm.can_edit,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: row.id,
    title: row.title,
    destination: row.destination ?? "",
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    coverEmoji: row.cover_emoji ?? "🌍",
    activities: activities.map((a) => ({ ...normalizeActivity(a), id: a.id ?? uid() })),
    people,
  };
}

function tripToRow(trip: Trip) {
  return {
    title: trip.title || "Untitled trip",
    destination: trip.destination ?? "",
    start_date: trip.startDate || null,
    end_date: trip.endDate || null,
    cover_emoji: trip.coverEmoji ?? "🌍",
    activities: trip.activities ?? [],
  };
}

export const TRIPS_KEY = ["trips"] as const;

export function useTrips() {
  const { user, ready: authReady } = useAuth();
  const { isAdmin, ready: roleReady } = useIsAdmin();
  const queryClient = useQueryClient();
  const key = [...TRIPS_KEY, user?.id ?? null];

  const query = useQuery({
    queryKey: key,
    enabled: authReady,
    queryFn: async (): Promise<Trip[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("trips")
        .select(TRIP_SELECT)
        .order("start_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return ((data ?? []) as unknown as TripRow[]).map(rowToTrip);
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
  }, [queryClient]);

  const save = useMutation({
    mutationKey: ["save-trip"],
    mutationFn: async (trip: Trip) => {
      if (!user) throw new Error("Sign in to save trips");
      const { error } = await supabase.from("trips").update(tripToRow(trip)).eq("id", trip.id);
      if (error) throw error;
    },
    // Show the change immediately; the server copy refreshes afterwards.
    onMutate: (trip) => {
      queryClient.setQueryData<Trip[]>(key, (old) => old?.map((t) => (t.id === trip.id ? trip : t)));
    },
    // Only refetch once the last pending save finishes, so a refetch can't
    // briefly undo an edit that is still on its way to the server.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ["save-trip"] }) <= 1) invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const saveTrip = useCallback((trip: Trip) => save.mutateAsync(trip), [save]);

  /** Apply a change to the LATEST copy of a trip (safe for rapid back-to-back edits). */
  const patchTrip = useCallback(
    (id: string, change: (t: Trip) => Trip) => {
      const latest = queryClient.getQueryData<Trip[]>(key)?.find((t) => t.id === id);
      if (!latest) return Promise.resolve();
      return save.mutateAsync(change(latest));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, save, user?.id],
  );
  const deleteTrip = useCallback((id: string) => remove.mutateAsync(id), [remove]);

  const createTrip = useCallback(
    async (partial?: Partial<Trip>): Promise<Trip> => {
      if (!user) throw new Error("Sign in to create trips");
      const { data, error } = await supabase
        .from("trips")
        .insert({
          title: partial?.title || "Untitled trip",
          destination: partial?.destination ?? "",
          start_date: partial?.startDate || null,
          end_date: partial?.endDate || null,
          cover_emoji: partial?.coverEmoji ?? "🌍",
          activities: partial?.activities ?? [],
        })
        .select(TRIP_SELECT)
        .single();
      if (error) throw error;
      // Put the creator on the trip so they show up in "who's going".
      const { data: me } = await supabase.from("members").select("id").eq("user_id", user.id).maybeSingle();
      if (me?.id) {
        await supabase.from("trip_members").insert({ trip_id: (data as { id: string }).id, member_id: me.id, can_edit: true });
      }
      invalidate();
      return rowToTrip(data as unknown as TripRow);
    },
    [user, invalidate],
  );

  /** Can the signed-in person change this trip? */
  const canEdit = useCallback(
    (trip: Trip | undefined) =>
      !!trip && (isAdmin || trip.people.some((p) => p.userId === user?.id && p.canEdit)),
    [isAdmin, user?.id],
  );

  return {
    trips: query.data ?? [],
    ready: authReady && roleReady && !query.isLoading,
    signedIn: !!user,
    isAdmin,
    canEdit,
    saveTrip,
    patchTrip,
    deleteTrip,
    createTrip,
    refresh: invalidate,
  };
}

export function useTrip(id: string | undefined) {
  const { trips, ready, signedIn, isAdmin, canEdit, patchTrip, deleteTrip, refresh } = useTrips();
  const trip = trips.find((t) => t.id === id);

  const updateTrip = useCallback(
    (patch: Partial<Trip>) => {
      if (id) void patchTrip(id, (t) => ({ ...t, ...patch }));
    },
    [id, patchTrip],
  );

  const addActivity = useCallback(
    (activity: Omit<Activity, "id">) => {
      if (id) void patchTrip(id, (t) => ({ ...t, activities: [...t.activities, { ...activity, id: uid() }] }));
    },
    [id, patchTrip],
  );

  const updateActivity = useCallback(
    (activity: Activity) => {
      if (id)
        void patchTrip(id, (t) => ({
          ...t,
          activities: t.activities.map((a) => (a.id === activity.id ? activity : a)),
        }));
    },
    [id, patchTrip],
  );

  const removeActivity = useCallback(
    (activityId: string) => {
      if (id) void patchTrip(id, (t) => ({ ...t, activities: t.activities.filter((a) => a.id !== activityId) }));
    },
    [id, patchTrip],
  );

  return {
    trip,
    ready,
    signedIn,
    isAdmin,
    canEdit: canEdit(trip),
    updateTrip,
    addActivity,
    updateActivity,
    removeActivity,
    deleteTrip,
    refresh,
  };
}

/** Admin: add/remove people on a trip and set whether they can edit. */
export function useTripPeopleAdmin(tripId: string) {
  const queryClient = useQueryClient();
  const done = () => queryClient.invalidateQueries({ queryKey: TRIPS_KEY });

  const setPerson = useCallback(
    async (memberId: string, on: boolean, canEdit = false) => {
      if (on) {
        const { error } = await supabase
          .from("trip_members")
          .upsert({ trip_id: tripId, member_id: memberId, can_edit: canEdit });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trip_members")
          .delete()
          .eq("trip_id", tripId)
          .eq("member_id", memberId);
        if (error) throw error;
      }
      await done();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripId],
  );

  return { setPerson };
}
