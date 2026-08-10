export type GscConnectionStatus = "disconnected" | "connected" | "error" | "revoked";

export type GscConnection = {
  id: string;
  provider: string;
  site_url: string;
  google_account_email: string | null;
  refresh_token_encrypted: string | null;
  scopes: string[];
  status: GscConnectionStatus;
  connected_at: string | null;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  next_sync_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  rows_collected: number;
  created_at: string;
  updated_at: string;
};

export type GscMetricRow = {
  report_date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscPageRow = GscMetricRow & { page: string };
export type GscQueryRow = GscMetricRow & { query: string };
