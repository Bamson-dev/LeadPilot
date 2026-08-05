export interface AffiliateCommission {
  referred_email: string;
  created_at: string;
  commission_usd?: number;
  commission_ngn?: number;
  sale_amount_usd?: number;
  sale_amount_ngn?: number;
  status?: string;
  id?: string;
}

export interface AffiliateStats {
  refCode: string | null;
  referralLink: string;
  totalReferrals: number;
  totalEarnedNgn: number;
  totalEarnedUsd: number;
  totalPaidNgn?: number;
  pendingNgn: number;
  pendingUsd: number;
  canRequestPayout: boolean;
  commissions: AffiliateCommission[];
}

export interface AffiliateBank {
  code: string;
  name: string;
}

export function maskReferredEmail(email: string): string {
  return email.replace(/(.{3}).*(@.*)/, "$1***$2");
}
