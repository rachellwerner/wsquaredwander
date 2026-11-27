import { Car, Hotel, Plane, Sparkles, UtensilsCrossed } from "lucide-react";
import type { ActivityType } from "@/lib/trips";

/** One simple icon per kind of entry (shared by cards, filters, calendar and pickers). */
export const BOOKING_ICONS: Record<ActivityType, typeof Plane> = {
  airfare: Plane,
  transportation: Car,
  hotel: Hotel,
  meal: UtensilsCrossed,
  activity: Sparkles,
};
