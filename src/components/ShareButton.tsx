import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Trip } from "@/lib/trips";
import { encodeTripPayload, publicCopy } from "@/lib/trips";
import { toast } from "sonner";

export function ShareButton({ trip }: { trip: Trip }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/shared/${encodeTripPayload(publicCopy(trip))}`
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — select the link manually.");
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: trip.title, text: `${trip.title} — itinerary`, url });
        return;
      } catch {
        /* fall through to dialog */
      }
    }
    setOpen(true);
  };

  return (
    <>
      <Button variant="outline" onClick={nativeShare} aria-label="Share">
        <Share2 className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Share</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Share this trip</DialogTitle>
            <DialogDescription>
              Anyone with this link can view the itinerary without signing in. Confirmation numbers, costs and names are left out. Family on the trip should sign in instead.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={copy} variant="secondary">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}