import {
  Building2, Flower2, Landmark, Martini, MountainSnow, Music, PartyPopper, Trees, Trophy, Umbrella, UtensilsCrossed, Waves,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/activity/activities";

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  ski: MountainSnow,
  surf: Waves,
  beach: Umbrella,
  festival: PartyPopper,
  concert: Music,
  sports: Trophy,
  food: UtensilsCrossed,
  nightlife: Martini,
  nature: Trees,
  culture: Landmark,
  wellness: Flower2,
  city: Building2,
};
