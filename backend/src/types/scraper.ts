export interface RawLeadInput {
  business_name: string;
  phone: string | null;
  email: string | null;
  extracted_email: string | null;
  generated_email: string | null;
  email_source: "extracted" | "generated" | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews_count: number | null;
  category: string | null;
  google_maps_url: string | null;
}
