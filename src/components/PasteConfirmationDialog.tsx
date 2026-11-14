import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parsePastedConfirmation } from "@/lib/email-intake.functions";

export function PasteConfirmationDialog({
  open,
  onOpenChange,
  onParsed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onParsed?: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parse = useServerFn(parsePastedConfirmation);
  const queryClient = useQueryClient();

  const submit = async () => {
    setBusy(true);
    try {
      const result = await parse({ data: { text } });
      if (result.count === 0) {
        toast.error("Couldn't find a booking in that text.");
      } else {
        toast.success(`Found ${result.count} booking${result.count === 1 ? "" : "s"} to review.`);
        setText("");
        onOpenChange(false);
        onParsed?.();
      }
      void queryClient.invalidateQueries({ queryKey: ["pending-bookings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that confirmation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add from a confirmation</DialogTitle>
          <DialogDescription>
            Paste a flight, hotel, transfer, or tour confirmation email. Bookings land in your review inbox.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={12}
          placeholder="Paste the full confirmation email here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || text.trim().length < 20}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Read confirmation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}