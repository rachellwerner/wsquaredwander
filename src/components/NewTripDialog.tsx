import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Trip } from "@/lib/trips";

const EMOJIS = ["✈️", "🏖️", "🏔️", "🍷", "🍝", "🗽", "🗼", "🏛️", "🌋", "🚆", "🏝️", "🌅", "🍀", "🥃"];

export function NewTripDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (details: Partial<Trip>) => void;
}) {
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [coverEmoji, setCoverEmoji] = useState("✈️");

  useEffect(() => {
    if (open) {
      setTitle("");
      setDestination("");
      setStartDate("");
      setEndDate("");
      setCoverEmoji("✈️");
    }
  }, [open]);

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), destination, startDate, endDate, coverEmoji });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">New trip details</DialogTitle>
          <DialogDescription>Start with the basics — you can refine everything later.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Cover</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setCoverEmoji(e)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition-all ${
                    coverEmoji === e
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "bg-card hover:bg-secondary"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="new-title" className="mb-1.5 block">
              Trip name
            </Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="new-destination" className="mb-1.5 block">
              Destination
            </Label>
            <Input
              id="new-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-start" className="mb-1.5 block">
                Start date
              </Label>
              <Input
                id="new-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-end" className="mb-1.5 block">
                End date
              </Label>
              <Input
                id="new-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">You can add the people on this trip from its Edit page.</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>
            Create trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}