import { Link } from "@tanstack/react-router";
import { Check, Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { firstName } from "@/lib/members";
import type { TripPerson } from "@/lib/trips";

/** Pick which people on the trip a booking is for. Stores member ids. */
export function WhoChips({
  people,
  value,
  onChange,
  tripId,
}: {
  people: TripPerson[];
  value: string[];
  onChange: (next: string[]) => void;
  tripId?: string;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const allOn = people.length > 0 && people.every((p) => value.includes(p.memberId));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Who’s going
        </Label>
        {people.length > 1 && (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => onChange(allOn ? [] : people.map((p) => p.memberId))}
          >
            {allOn ? "Clear" : "Everyone"}
          </button>
        )}
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one is on this trip yet —{" "}
          {tripId ? (
            <Link
              to="/trip/$tripId/edit"
              params={{ tripId }}
              className="font-medium text-primary underline underline-offset-4"
            >
              add people
            </Link>
          ) : (
            "add people"
          )}{" "}
          first.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => {
            const on = value.includes(p.memberId);
            return (
              <button
                key={p.memberId}
                type="button"
                onClick={() => toggle(p.memberId)}
                aria-pressed={on}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/50 text-foreground/80 hover:bg-secondary"
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" />}
                {firstName(p.name)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Small name badges on a booking card. Unknown ids (people removed from the trip) are skipped. */
export function WhoBadges({ who, people }: { who?: string[]; people: TripPerson[] }) {
  if (!who || who.length === 0) return null;
  const names = who
    .map((id) => people.find((p) => p.memberId === id)?.name)
    .filter((n): n is string => !!n);
  if (names.length === 0) return null;
  const everyone = people.length > 1 && names.length === people.length;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {everyone ? (
        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground/80">
          Everyone
        </span>
      ) : (
        names.map((name) => (
          <span
            key={name}
            className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground/80"
          >
            {firstName(name)}
          </span>
        ))
      )}
    </div>
  );
}
