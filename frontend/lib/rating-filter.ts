import type { Lead } from "@/types/lead";

export type RatingFilterValue =
  | "all"
  | "4.5+"
  | "4.0+"
  | "below4"
  | "below3.5"
  | "below3";

export const RATING_FILTER_OPTIONS: Array<{ value: RatingFilterValue; label: string }> = [
  { value: "all", label: "All Ratings" },
  { value: "4.5+", label: "4.5 and above" },
  { value: "4.0+", label: "4.0 and above" },
  { value: "below4", label: "Below 4.0" },
  { value: "below3.5", label: "Below 3.5" },
  { value: "below3", label: "Below 3.0" },
];

export function applyRatingFilter(leads: Lead[], filter: RatingFilterValue): Lead[] {
  if (filter === "all") return leads;

  return leads.filter((lead) => {
    if (lead.rating == null) return false;

    switch (filter) {
      case "4.5+":
        return lead.rating >= 4.5;
      case "4.0+":
        return lead.rating >= 4.0;
      case "below4":
        return lead.rating < 4.0;
      case "below3.5":
        return lead.rating < 3.5;
      case "below3":
        return lead.rating < 3.0;
      default:
        return true;
    }
  });
}
