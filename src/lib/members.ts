export type MemberRole = "admin" | "member";

export type Member = {
  id: string;
  userId: string | null;
  name: string;
  email: string; // "" when the person has no login (e.g. kids)
  phone: string;
  birthday: string | null;
  invitedAt: string | null;
  role: MemberRole;
};

export type MemberRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  invited_at: string | null;
  role: MemberRole | null;
};

export function roleLabel(role: MemberRole) {
  return role === "admin" ? "Admin" : "Traveler";
}

export function rowToMember(row: MemberRow): Member {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    birthday: row.birthday,
    invitedAt: row.invited_at,
    role: row.role ?? "member",
  };
}


export function firstName(name: string) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function formatBirthday(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function initials(name: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}
