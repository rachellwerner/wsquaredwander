import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Compass, Inbox, Mail, Trash2, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useTrips } from "@/lib/use-trips";
import { ACTIVITY_META, daysBetween, formatDayLabel, todayIso, uid, type Activity, type Trip } from "@/lib/trips";
import { AppShell } from "@/components/AppShell";
import { getForwardingAddress } from "@/lib/email-intake.functions";
import { PasteConfirmationDialog } from "@/components/PasteConfirmationDialog";
import { canonicalUrl } from "@/lib/site";

export const Route = createFileRoute("/inbox")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Review inbox — W²ander" },
      { name: "description", content: "Review bookings W²ander (read “Wander Squared”) found in your forwarded confirmation emails, then add them to the right trip and day." },
      { property: "og:title", content: "Review inbox — W²ander" },
      { property: "og:description", content: "Approve bookings detected from your forwarded confirmation emails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: canonicalUrl("/inbox") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/inbox") }],
  }),
  component: InboxPage,
});

type PendingRow = {
  id: string;
  trip_id: string | null;
  booking: Record<string, string>;
  booking_date: string | null;
  created_at: string;
  inbound_emails: { subject: string | null; from_email: string | null; source: string } | null;
};

function dayIndexFor(trip: Trip, date: string | null): number {
  if (!date || !trip.startDate) return 0;
  const days = daysBetween(trip.startDate, trip.endDate);
  const idx = days.findIndex((d) => todayIso(d) === date);
  return idx === -1 ? 0 : idx;
}

function InboxPage() {
  const { user, ready: authReady } = useAuth();
  const { trips, patchTrip } = useTrips();
  const queryClient = useQueryClient();
  const [pasteOpen, setPasteOpen] = useState(false);
  const fetchAddress = useServerFn(getForwardingAddress);

  const pending = useQuery({
    queryKey: ["pending-bookings", user?.id ?? null],
    enabled: authReady && !!user,
    queryFn: async (): Promise<PendingRow[]> => {
      const { data, error } = await supabase
        .from("parsed_bookings")
        .select("id,trip_id,booking,booking_date,created_at,inbound_emails(subject,from_email,source)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingRow[];
    },
  });

  const address = useQuery({
    queryKey: ["forwarding-address", user?.id ?? null],
    enabled: authReady && !!user,
    queryFn: () => fetchAddress(),
  });

  if (authReady && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="font-serif text-3xl">Sign in to use your inbox</h1>
          <p className="mt-2 text-muted-foreground">
            Your review inbox holds bookings found in confirmation emails.
          </p>
          <Link to="/auth" className="mt-6 inline-block">
            <Button>Sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  const rows = pending.data ?? [];

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-serif text-3xl font-medium">Review inbox</h1>
          <Button variant="secondary" onClick={() => setPasteOpen(true)}>
            <Mail className="mr-2 h-4 w-4" /> Paste a confirmation
          </Button>
        </div>
        <p className="mt-1 text-muted-foreground">
          Nothing is added to a trip until you approve it.
        </p>

        <ForwardingPanel address={address.data?.address ?? null} code={address.data?.code} />

        {rows.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed bg-card/60 p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-accent">
              <Inbox className="h-6 w-6" />
            </div>
            <h3 className="font-serif text-xl font-medium">Nothing to review</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Forward a confirmation email, or paste one in to get started.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map((row) => (
              <PendingCard
                key={row.id}
                row={row}
                trips={trips}
                onDone={() => {
                  void queryClient.invalidateQueries({ queryKey: ["pending-bookings"] });
                }}
                onApprove={(tripId, activity) => patchTrip(tripId, (t) => ({ ...t, activities: [...t.activities, activity] }))}
              />
            ))}
          </div>
        )}
      </main>

      <PasteConfirmationDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onParsed={() => queryClient.invalidateQueries({ queryKey: ["pending-bookings"] })}
      />
    </AppShell>
  );
}

function ForwardingPanel({ address, code }: { address: string | null; code?: string }) {
  return (
    <div className="mt-6 rounded-2xl border bg-card p-5">
      <h2 className="font-serif text-lg font-medium">Your forwarding address</h2>
      {address ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-secondary px-2.5 py-1.5 text-sm">{address}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(address);
              toast.success("Address copied");
            }}
          >
            <Copy className="mr-2 h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Email forwarding isn't switched on yet. Once an inbound email domain is connected, your personal
          address will be <code className="rounded bg-secondary px-1.5 py-0.5">{code ?? "yourname"}@wsquaredwander.com</code>.
          Until then, paste confirmations in above.
        </p>
      )}
    </div>
  );
}

function PendingCard({
  row,
  trips,
  onDone,
  onApprove,
}: {
  row: PendingRow;
  trips: Trip[];
  onDone: () => void;
  onApprove: (tripId: string, activity: Activity) => Promise<unknown>;
}) {
  const booking = row.booking ?? {};
  const type = (booking["type"] as Activity["type"]) ?? "activity";
  const meta = ACTIVITY_META[type] ?? ACTIVITY_META.activity;

  const suggested = useMemo(() => {
    if (!row.booking_date) return trips[0]?.id ?? "";
    const match = trips.find(
      (t) => t.startDate && t.endDate && row.booking_date! >= t.startDate && row.booking_date! <= t.endDate,
    );
    return (match ?? trips[0])?.id ?? "";
  }, [trips, row.booking_date]);

  const [tripId, setTripId] = useState(row.trip_id ?? suggested);
  const [title, setTitle] = useState(booking["title"] ?? "Booking");
  const [busy, setBusy] = useState(false);

  const trip = trips.find((t) => t.id === tripId);
  const days = trip ? daysBetween(trip.startDate, trip.endDate) : [];
  const [dayIndex, setDayIndex] = useState<number>(trip ? dayIndexFor(trip, row.booking_date) : 0);

  const details = Object.entries(booking).filter(
    ([key]) => !["type", "title", "date"].includes(key),
  );

  const approve = async () => {
    if (!trip) {
      toast.error("Pick a trip first");
      return;
    }
    setBusy(true);
    try {
      const activity: Activity = {
        ...(booking as unknown as Activity),
        id: uid(),
        type,
        title,
        dayIndex: Math.min(Math.max(dayIndex, 0), Math.max(days.length - 1, 0)),
      };
      delete (activity as unknown as Record<string, unknown>)["date"];
      await onApprove(trip.id, activity);
      const { error } = await supabase
        .from("parsed_bookings")
        .update({ status: "approved", trip_id: trip.id })
        .eq("id", row.id);
      if (error) throw error;
      toast.success(`Added to ${trip.title}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that booking");
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    const { error } = await supabase.from("parsed_bookings").update({ status: "discarded" }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onDone();
  };

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.fg}`}>
          {meta.label}
        </span>
        {row.booking_date && <span className="text-xs text-muted-foreground">{row.booking_date}</span>}
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {row.inbound_emails?.subject ?? (row.inbound_emails?.source === "paste" ? "Pasted text" : "Forwarded email")}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`title-${row.id}`}>Title</Label>
          <Input id={`title-${row.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Trip</Label>
          <Select
            value={tripId}
            onValueChange={(v) => {
              setTripId(v);
              const next = trips.find((t) => t.id === v);
              if (next) setDayIndex(dayIndexFor(next, row.booking_date));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a trip" />
            </SelectTrigger>
            <SelectContent>
              {trips.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {days.length > 0 && (
          <div className="space-y-1.5">
            <Label>Day</Label>
            <Select value={String(dayIndex)} onValueChange={(v) => setDayIndex(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>
                    Day {i + 1} — {formatDayLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {details.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {details.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="truncate">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={discard}>
          <Trash2 className="mr-2 h-4 w-4" /> Discard
        </Button>
        <Button size="sm" onClick={approve} disabled={busy || !trip}>
          <Check className="mr-2 h-4 w-4" /> Add to trip
        </Button>
      </div>

      {trips.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Create a trip first, then assign this booking.</p>
      )}
    </div>
  );
}