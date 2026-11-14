import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhoChips } from "@/components/WhoChips";
import type { Activity, ActivityType, TripPerson } from "@/lib/trips";
import { ACTIVITY_META, normalizeType, placeQuery } from "@/lib/trips";

type Draft = Omit<Activity, "id"> & { id?: string };

const BOOKING_TYPES: ActivityType[] = ["airfare", "hotel", "transportation", "activity"];

const TITLE_PLACEHOLDER: Record<ActivityType, string> = {
  airfare: "Flight to Rome",
  hotel: "Hotel Artemide",
  transportation: "Train to Florence",
  activity: "Vatican Museums",
};

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
  onSave: (activity: Draft) => void;
  people: TripPerson[];
  tripId?: string;
  submitLabel?: string;
  title?: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    type: "activity",
    title: "",
    dayIndex,
  }));

  useEffect(() => {
    if (open) {
      setDraft(
        initial
          ? ({ title: "", dayIndex, ...initial, type: normalizeType(initial.type) } as Draft)
          : { type: "activity", title: "", dayIndex },
      );
    }
  }, [open, initial, dayIndex]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = () => {
    if (!draft.title.trim()) return;
    // If the place changed, drop the old map pin so it gets looked up again.
    const next = { ...draft };
    if (next.geocodedFrom !== undefined && placeQuery(next as Activity) !== next.geocodedFrom) {
      delete next.lat;
      delete next.lng;
      delete next.geocodedFrom;
    }
    onSave(next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {title ?? (initial?.id ? "Edit booking" : "Add booking")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Booking type</Label>
            <Select
              value={draft.type}
              onValueChange={(v) => set("type", v as ActivityType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a booking type" />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACTIVITY_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="title" className="mb-1.5 block">
              Title
            </Label>
            <Input
              id="title"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={TITLE_PLACEHOLDER[draft.type]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Start time</Label>
              <Input
                type="time"
                value={draft.startTime ?? ""}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">End time</Label>
              <Input
                type="time"
                value={draft.endTime ?? ""}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
          </div>

          {draft.type === "airfare" && (
            <div className="space-y-3 rounded-lg border bg-secondary/40 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Airline</Label>
                  <Input
                    value={draft.airline ?? ""}
                    onChange={(e) => set("airline", e.target.value)}
                    placeholder="Delta"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Flight number</Label>
                  <Input
                    value={draft.flightNumber ?? ""}
                    onChange={(e) => set("flightNumber", e.target.value)}
                    placeholder="DL 244"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Departure airport</Label>
                  <Input
                    value={draft.from ?? ""}
                    onChange={(e) => set("from", e.target.value)}
                    placeholder="JFK"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Arrival airport</Label>
                  <Input
                    value={draft.to ?? ""}
                    onChange={(e) => set("to", e.target.value)}
                    placeholder="FCO"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1.5 block">Duration</Label>
                  <Input
                    value={draft.duration ?? ""}
                    onChange={(e) => set("duration", e.target.value)}
                    placeholder="8h 25m"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Terminal / gate</Label>
                  <Input
                    value={draft.terminal ?? ""}
                    onChange={(e) => set("terminal", e.target.value)}
                    placeholder="T4 · B22"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Seats</Label>
                  <Input
                    value={draft.seats ?? ""}
                    onChange={(e) => set("seats", e.target.value)}
                    placeholder="12A–12D"
                  />
                </div>
              </div>
            </div>
          )}

          {draft.type === "transportation" && (
            <div className="space-y-3 rounded-lg border bg-secondary/40 p-3">
              <div>
                <Label className="mb-1.5 block">Mode</Label>
                <Select value={draft.mode ?? ""} onValueChange={(v) => set("mode", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Train, rental car, transfer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Train", "Rental car", "Private transfer", "Taxi / rideshare", "Bus", "Ferry", "Metro"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Provider</Label>
                <Input
                  value={draft.provider ?? ""}
                  onChange={(e) => set("provider", e.target.value)}
                  placeholder="Trenitalia, Hertz…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Pickup / departure</Label>
                  <Input
                    value={draft.pickup ?? ""}
                    onChange={(e) => set("pickup", e.target.value)}
                    placeholder="Roma Termini"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Drop-off / arrival</Label>
                  <Input
                    value={draft.dropoff ?? ""}
                    onChange={(e) => set("dropoff", e.target.value)}
                    placeholder="Firenze S.M.N."
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Duration</Label>
                <Input
                  value={draft.duration ?? ""}
                  onChange={(e) => set("duration", e.target.value)}
                  placeholder="1h 35m"
                />
              </div>
            </div>
          )}

          {draft.type === "hotel" && (
            <div className="space-y-3 rounded-lg border bg-secondary/40 p-3">
              <div>
                <Label className="mb-1.5 block">Hotel name</Label>
                <Input
                  value={draft.hotelName ?? ""}
                  onChange={(e) => set("hotelName", e.target.value)}
                  placeholder="Hotel Artemide"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Address</Label>
                <Input
                  value={draft.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Via Nazionale 22, Rome"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Check-in</Label>
                  <Input
                    type="date"
                    value={draft.checkIn ?? ""}
                    onChange={(e) => set("checkIn", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Check-out</Label>
                  <Input
                    type="date"
                    value={draft.checkOut ?? ""}
                    onChange={(e) => set("checkOut", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Room type</Label>
                  <Input
                    value={draft.roomType ?? ""}
                    onChange={(e) => set("roomType", e.target.value)}
                    placeholder="2 double rooms"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Guests</Label>
                  <Input
                    value={draft.guests ?? ""}
                    onChange={(e) => set("guests", e.target.value)}
                    placeholder="4"
                  />
                </div>
              </div>
            </div>
          )}

          {draft.type === "activity" && (
            <div className="space-y-3 rounded-lg border bg-secondary/40 p-3">
              <div>
                <Label className="mb-1.5 block">Category</Label>
                <Select
                  value={draft.category ?? ""}
                  onValueChange={(v) => set("category", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Museum, wine tasting…" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Museum",
                      "Wine tasting",
                      "Walking tour",
                      "Food",
                      "Sightseeing",
                      "Outdoors",
                      "Show",
                      "Other",
                    ].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Location</Label>
                <Input
                  value={draft.location ?? ""}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Piazza San Pietro"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Meeting point</Label>
                  <Input
                    value={draft.meetingPoint ?? ""}
                    onChange={(e) => set("meetingPoint", e.target.value)}
                    placeholder="Outside the main gate"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Tickets</Label>
                  <Input
                    value={draft.tickets ?? ""}
                    onChange={(e) => set("tickets", e.target.value)}
                    placeholder="4 adult, 2 child"
                  />
                </div>
              </div>
            </div>
          )}

          <WhoChips people={people} tripId={tripId} value={draft.who ?? []} onChange={(next) => set("who", next)} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Confirmation #</Label>
              <Input
                value={draft.confirmation ?? ""}
                onChange={(e) => set("confirmation", e.target.value)}
                placeholder="ABC123"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Cost</Label>
              <Input
                value={draft.cost ?? ""}
                onChange={(e) => set("cost", e.target.value)}
                placeholder="$1,240"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Website / booking link</Label>
            <Input
              type="url"
              value={draft.url ?? ""}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Notes</Label>
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Confirmation #, tips, what to bring…"
              rows={3}
            />
          </div>
        </div>

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