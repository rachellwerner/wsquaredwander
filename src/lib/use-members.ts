import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { rowToMember, type Member, type MemberRow } from "./members";

export const MEMBERS_KEY = ["members"] as const;

export function useMembers() {
  const { user, ready } = useAuth();

  const query = useQuery({
    queryKey: [...MEMBERS_KEY, user?.id ?? null],
    enabled: ready && !!user,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("members")
        .select("id,user_id,name,email,phone,birthday,invited_at,role")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => rowToMember(r as MemberRow));
    },
  });

  return { members: query.data ?? [], loading: query.isLoading, refetch: query.refetch };
}

export function useIsAdmin() {
  const { user, ready } = useAuth();

  const query = useQuery({
    queryKey: ["is-admin", user?.id ?? null],
    enabled: ready && !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("is_admin");
      if (error) throw error;
      return data === true;
    },
  });

  return { isAdmin: query.data === true, ready: ready && !query.isLoading };
}

/** The signed-in person's own member row (null until linked). */
export function useMe() {
  const { user, ready } = useAuth();
  const { members, loading } = useMembers();
  const me = user ? (members.find((m) => m.userId === user.id) ?? null) : null;
  return { me, ready: ready && !loading };
}
