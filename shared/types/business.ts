export interface BusinessLead {
  id: string;
  searchId: string;
  name: string;
  category: string;
  address: string;
  phone: string | null;
  email: string | null;
  emailSource: "website" | "generated" | "none";
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  googleMapsUrl: string | null;
  hasWebsite: boolean;
  hasInstagram: boolean;
  createdAt: string;
}
