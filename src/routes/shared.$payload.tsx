import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TripHeader } from "@/components/TripHeader";
import { TripDayList } from "@/components/TripDayList";
import { decodeTripPayload, type Trip } from "@/lib/trips";

export const Route = createFileRoute("/shared/$payload")({
  component: SharedTripView,
});

function SharedTripView() {
  const { payload } = Route.useParams();
  const trip = useMemo<Trip | null>(() => {
    const t = decodeTripPayload(payload);
    return t ? { ...t, people: [], activities: t.activities ?? [] } : null;
  }, [payload]);

  if (!trip) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-serif text-3xl">Link looks broken</h1>
          <p className="mt-2 text-muted-foreground">We couldn't read this shared trip. Ask the sender to share again.</p>
          <Link to="/" className="mt-6 inline-block">
            <Button>Go home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Compass className="h-4 w-4" />
            </span>
            <span className="font-serif text-lg font-semibold">W²ander</span>
          </Link>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Shared itinerary</span>
        </div>
      </header>

      <TripHeader trip={trip} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <TripDayList trip={trip} readOnly />
      </main>
    </div>
  );
}
