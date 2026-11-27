import { useMemo, useState } from "react";
import { Check, Crown, Plus, RotateCcw, Trash2, Vote, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityCard } from "./ActivityCard";
import { ActivityDialog } from "./ActivityDialog";
import { usePolls, type Poll } from "@/lib/use-polls";
import { firstName } from "@/lib/members";
import { daysBetween, formatDayLabel, uid, type Activity, type Trip } from "@/lib/trips";

export function PollsPanel({
  trip,
  canEdit,
  meId,
  onAddActivity,
}: {
  trip: Trip;
  canEdit: boolean;
  meId: string | null;
  onAddActivity: (a: Omit<Activity, "id">) => void;
}) {
  const { polls, loading, createPoll, vote, setStatus, deletePoll } = usePolls(trip.id);
  const [newOpen, setNewOpen] = useState(false);
  const days = useMemo(() => daysBetween(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const open = polls.filter((p) => p.status === "open");
  const closed = polls.filter((p) => p.status === "closed");

  const dayLabel = (i: number | null) =>
    i == null ? null : days[i] ? `Day ${i + 1} · ${formatDayLabel(days[i]!)}` : `Day ${i + 1}`;

  const pick = async (poll: Poll, optionId: string) => {
    const option = poll.options.find((o) => o.id === optionId);
    if (!option) return;
    if (!window.confirm(`Add “${option.activity.title}” to the itinerary and close this vote?`)) return;
    try {
      onAddActivity({ ...option.activity, dayIndex: poll.dayIndex ?? option.activity.dayIndex ?? 0 });
      await setStatus(poll.id, "closed", optionId);
      toast.success("Added to the itinerary");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not close that vote");
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium">Vote on plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {canEdit
              ? "Suggest a few options, let everyone vote, then pick the winner to add it to the itinerary."
              : "Tap your favorite option. You can change your vote until the vote is closed."}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New vote
          </Button>
        )}
      </div>

      {!meId && (
        <p className="mb-4 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          You’re not linked to a person on this trip yet, so you can’t vote. Ask Rachel to add you.
        </p>
      )}

      {loading ? null : polls.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center">
          <Vote className="mx-auto mb-2 h-8 w-8 text-accent" />
          <p className="text-muted-foreground">No votes yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...open, ...closed].map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              trip={trip}
              meId={meId}
              canEdit={canEdit}
              dayLabel={dayLabel(poll.dayIndex)}
              onVote={async (optionId) => {
                if (!meId) return;
                try {
                  await vote(poll.id, meId, optionId);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not save your vote");
                }
              }}
              onPick={(optionId) => pick(poll, optionId)}
              onReopen={() => setStatus(poll.id, "open", null)}
              onDelete={async () => {
                if (window.confirm("Delete this vote and everyone’s answers?")) await deletePoll(poll.id);
              }}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <NewPollDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          trip={trip}
          days={days}
          onCreate={async (input) => {
            try {
              await createPoll(input);
              toast.success("Vote started");
              setNewOpen(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not start that vote");
            }
          }}
        />
      )}
    </div>
  );
}

function PollCard({
  poll,
  trip,
  meId,
  canEdit,
  dayLabel,
  onVote,
  onPick,
  onReopen,
  onDelete,
}: {
  poll: Poll;
  trip: Trip;
  meId: string | null;
  canEdit: boolean;
  dayLabel: string | null;
  onVote: (optionId: string | null) => void;
  onPick: (optionId: string) => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const isOpen = poll.status === "open";
  const myVote = poll.votes.find((v) => v.memberId === meId)?.optionId ?? null;
  const counts = new Map<string, number>();
  poll.votes.forEach((v) => counts.set(v.optionId, (counts.get(v.optionId) ?? 0) + 1));
  const max = Math.max(0, ...counts.values());
  const nameOf = (id: string) => firstName(trip.people.find((p) => p.memberId === id)?.name ?? "");
  const waitingOn = trip.people.filter((p) => p.userId && !poll.votes.some((v) => v.memberId === p.memberId));

  return (
    <section className={`rounded-2xl border bg-card p-4 shadow-sm sm:p-5 ${isOpen ? "" : "opacity-80"}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-accent">
            {isOpen ? "Voting open" : "Decided"}
            {dayLabel && <span className="normal-case tracking-normal text-muted-foreground">· {dayLabel}</span>}
          </div>
          <h3 className="mt-0.5 font-serif text-xl font-medium">{poll.question}</h3>
          {isOpen && waitingOn.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Waiting on {waitingOn.map((p) => firstName(p.name)).join(", ")}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1">
            {!isOpen && (
              <Button size="icon" variant="ghost" onClick={onReopen} aria-label="Reopen vote">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete vote" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {poll.options.map((opt) => {
          const n = counts.get(opt.id) ?? 0;
          const mine = myVote === opt.id;
          const chosen = poll.chosenOptionId === opt.id;
          const leading = isOpen && n > 0 && n === max;
          const voters = poll.votes.filter((v) => v.optionId === opt.id).map((v) => nameOf(v.memberId)).filter(Boolean);
          return (
            <div
              key={opt.id}
              className={`rounded-xl border-2 p-1 transition-colors ${
                chosen ? "border-primary" : mine ? "border-primary/60" : "border-transparent"
              }`}
            >
              <ActivityCard activity={{ ...opt.activity, id: opt.id }} people={trip.people} readOnly compact defaultExpanded={false} showStatus={false} />
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-2">
                <div className="min-w-0 text-sm">
                  <span className="font-semibold">
                    {n} vote{n === 1 ? "" : "s"}
                  </span>
                  {leading && <span className="ml-2 text-xs font-medium text-accent">Leading</span>}
                  {chosen && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <Crown className="h-3 w-3" /> Picked
                    </span>
                  )}
                  {voters.length > 0 && <p className="truncate text-xs text-muted-foreground">{voters.join(", ")}</p>}
                </div>
                <div className="flex gap-2">
                  {isOpen && meId && (
                    <Button size="sm" variant={mine ? "default" : "outline"} onClick={() => onVote(mine ? null : opt.id)}>
                      {mine ? (
                        <>
                          <Check className="mr-1 h-4 w-4" /> My pick
                        </>
                      ) : (
                        "Vote"
                      )}
                    </Button>
                  )}
                  {isOpen && canEdit && (
                    <Button size="sm" variant="secondary" onClick={() => onPick(opt.id)}>
                      <Crown className="mr-1 h-4 w-4" /> Choose
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NewPollDialog({
  open,
  onOpenChange,
  trip,
  days,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trip: Trip;
  days: Date[];
  onCreate: (input: { question: string; dayIndex: number | null; options: Omit<Activity, "id">[] }) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [day, setDay] = useState<string>("any");
  const [options, setOptions] = useState<(Omit<Activity, "id"> & { key: string })[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const dayIndex = day === "any" ? null : Number(day);

  const reset = () => {
    setQuestion("");
    setDay("any");
    setOptions([]);
  };

  return (
    <>
      <Dialog
        open={open && !adding}
        onOpenChange={(o) => {
          if (!o && !adding) {
            onOpenChange(false);
            reset();
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">New vote</DialogTitle>
            <DialogDescription>Add two or more options. Everyone on the trip can vote.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="poll-q" className="mb-1.5 block">
                Question
              </Label>
              <Input
                id="poll-q"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What should we do Saturday afternoon?"
              />
            </div>
            {days.length > 0 && (
              <div>
                <Label className="mb-1.5 block">Which day?</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Not decided yet</SelectItem>
                    {days.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>
                        Day {i + 1} · {formatDayLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">Options</Label>
              <div className="space-y-2">
                {options.map((o) => (
                  <div key={o.key} className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.title}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${o.title}`}
                      onClick={() => setOptions((list) => list.filter((x) => x.key !== o.key))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Add an option
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || !question.trim() || options.length < 2}
              onClick={async () => {
                setBusy(true);
                await onCreate({
                  question: question.trim(),
                  dayIndex,
                  options: options.map(({ key, ...a }) => ({ ...a, dayIndex: dayIndex ?? a.dayIndex })),
                });
                setBusy(false);
                reset();
              }}
            >
              Start vote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActivityDialog
        open={adding}
        onOpenChange={(o) => setAdding(o)}
        dayIndex={dayIndex ?? 0}
        people={trip.people}
        tripId={trip.id}
        title="Add an option"
        submitLabel="Add option"
        onSave={(draft) => {
          const { id: _ignore, ...rest } = draft;
          setOptions((list) => [...list, { ...rest, key: uid() }]);
        }}
      />
    </>
  );
}
