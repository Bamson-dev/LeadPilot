export type ConfidenceLabel = "high" | "medium" | "low";

export type PredictionSource =
  | "business_pattern"
  | "category_pattern"
  | "owner_name";

export interface PredictedEmail {
  email: string;
  confidence: number;
  label: ConfidenceLabel;
  source: PredictionSource;
}

export interface LeadEmailPayload {
  verifiedEmails: string[];
  predictedEmails: PredictedEmail[];
}
