import type { PredictedEmail } from "./email";

export interface BusinessLead {
  id: string;
  searchId: string;
  name: string;
  category: string;
  address: string;
  phone: string | null;
  /** Primary email (first verified) for backwards compatibility. */
  email: string | null;
  /** All verified emails found (Maps panel + website crawl). */
  emails: string[];
  verifiedEmails: string[];
  predictedEmails: PredictedEmail[];
  emailSource: "website" | "predicted" | "none";
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  googleMapsUrl: string | null;
  hasWebsite: boolean;
  hasInstagram: boolean;
  createdAt: string;
}
