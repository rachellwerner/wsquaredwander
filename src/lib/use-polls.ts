import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Activity } from "./trips";

export type PollOption = { id: string; activity: Omit<Activity, "id">; sort: number };
export type PollVote = { memberId: string; optionId: string };
export type Poll = {
  id: string;
  tripId: string;
  question: string;
  dayIndex: number | null;
  status: "open" | "closed";
  chosenOptionId: string | null;
  createdAt: string;
  options: PollOption[];
  votes: PollVote[];
};

type PollRow = {
  id: string;
  trip_id: string;
  question: string;
  day_index: number | null;
  status: "open" | "closed";
  chosen_option_id: string | null;
  created_at: string;
  poll_options: { id: string; activity: Omit<Activity, "id">; sort: number }[] | null;
  poll_votes: { member_id: string; option_id: string }[] | null;
};

const POLL_SELECT =
  "id,trip_id,question,day_index,status,chosen_option_id,created_at," +
  "poll_options(id,activity,sort),poll_votes(member_id,option_id)";

function rowToPoll(r: PollRow): Poll {
  return {
    id: r.id,
    tripId: r.trip_id,
    question: r.question,
    dayIndex: r.day_index,
    status: r.status,
    chosenOptionId: r.chosen_option_id,
    createdAt: r.created_at,
    options: [...(r.poll_options ?? [])].sort((a, b) => a.sort - b.sort),
    votes: (r.poll_votes ?? []).map((v) => ({ memberId: v.member_id, optionId: v.option_id })),
  };
}

export const pollsKey = (tripId: string) => ["polls", tripId] as const;

export function usePolls(tripId: string) {
  const queryClient = useQueryClient();
  const key = pollsKey(tripId);

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Poll[]> => {
      const { data, error } = await supabase
        .from("polls")
        .select(POLL_SELECT)
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as PollRow[]).map(rowToPoll);
    },
    refetchInterval: 30_000, // pick up other people's votes
  });

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: key }), [queryClient, tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const createPoll = useCallback(
    async (input: { question: string; dayIndex: number | null; options: Omit<Activity, "id">[] }) => {
      const { data, error } = await supabase
        .from("polls")
        .insert({ trip_id: tripId, question: input.question, day_index: input.dayIndex })
        .select("id")
        .single();
      if (error) throw error;
      const { error: optError } = await supabase
        .from("poll_options")
        .insert(input.options.map((activity, i) => ({ poll_id: data.id, activity, sort: i })));
      if (optError) {
        await supabase.from("polls").delete().eq("id", data.id);
        throw optError;
      }
      await refresh();
    },
    [tripId, refresh],
  );

  const vote = useCallback(
    async (pollId: string, memberId: string, optionId: string | null) => {
      // Optimistic update so tapping feels instant
      queryClient.setQueryData<Poll[]>(key, (old) =>
        old?.map((p) =>
          p.id !== pollId
            ? p
            : {
                ...p,
                votes: [
                  ...p.votes.filter((v) => v.memberId !== memberId),
                  ...(optionId ? [{ memberId, optionId }] : []),
                ],
              },
        ),
      );
      const { error } = optionId
        ? await supabase.from("poll_votes").upsert({ poll_id: pollId, member_id: memberId, option_id: optionId })
        : await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("member_id", memberId);
      if (error) {
        await refresh();
        throw error;
      }
      await refresh();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, tripId, refresh],
  );

  const setStatus = useCallback(
    async (pollId: string, status: "open" | "closed", chosenOptionId: string | null) => {
      const { error } = await supabase
        .from("polls")
        .update({ status, chosen_option_id: chosenOptionId })
        .eq("id", pollId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const deletePoll = useCallback(
    async (pollId: string) => {
      const { error } = await supabase.from("polls").delete().eq("id", pollId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return {
    polls: query.data ?? [],
    loading: query.isLoading,
    createPoll,
    vote,
    setStatus,
    deletePoll,
  };
}
