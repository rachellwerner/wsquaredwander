// Dialog version of the entry editor. The itinerary edits entries right in their cards;
// this is only used where a dialog is already open (adding options to a vote).
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookingDetailFields, BookingSummaryFields, prepareForSave, type BookingDraft } from "@/components/BookingFields";
import type { Activity, TripPerson } from "@/lib/trips";
import { normalizeType } from "@/lib/trips";

export function ActivityDialog({
  open,
  onOpenChange,
  initial,
  dayIndex,
  onSave,
  people,
  tripId,
  submitLabel,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<Activity> | null;
  dayIndex: number;
  onSave: (activity: BookingDraft) => void;
  people: TripPerson[];
  tripId?: string;
  submitLabel?: string;
  title?: string;
}) {
  const [draft, setDraft] = useState<BookingDraft>({ type: "activity", title: "", dayIndex });
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setMoreOpen(false);
      setDraft(
        initial
          ? ({ title: "", dayIndex, ...initial, type: normalizeType(initial.type) } as BookingDraft)
          : { type: "activity", title: "", dayIndex },
      );
    }
  }, [open, initial, dayIndex]);

  const set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = () => {
    if (!draft.title.trim()) return;
    onSave(prepareForSave(draft));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{title ?? (initial?.id ? "Edit entry" : "Add entry")}</DialogTitle>
        </DialogHeader>

        <BookingSummaryFields draft={draft} set={set} />
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          {moreOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} More details
        </button>
        {moreOpen && <BookingDetailFields draft={draft} set={set} people={people} tripId={tripId} />}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!draft.title.trim()}>
            {submitLabel ?? "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
