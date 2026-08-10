import { logger } from "../utils/logger";

export type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export async function listSearchConsoleSites(accessToken: string): Promise<string[]> {
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("GSC sites.list failed", {
      status: response.status,
      body: body.slice(0, 200),
    });
    throw new Error(`sites_list_failed:${response.status}`);
  }
  const json = (await response.json()) as {
    siteEntry?: Array<{ siteUrl?: string }>;
  };
  return (json.siteEntry || [])
    .map((s) => s.siteUrl)
    .filter((s): s is string => Boolean(s));
}

export async function querySearchAnalytics(
  accessToken: string,
  input: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    dimensions: string[];
    rowLimit?: number;
  }
): Promise<SearchAnalyticsRow[]> {
  const siteUrl = encodeURIComponent(input.siteUrl);
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: input.dimensions,
        rowLimit: input.rowLimit ?? 25000,
        dataState: "final",
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("GSC searchAnalytics.query failed", {
      status: response.status,
      dimensions: input.dimensions.join(","),
      siteUrl: input.siteUrl,
      body: body.slice(0, 300),
    });
    throw new Error(`search_analytics_failed:${response.status}`);
  }

  const json = (await response.json()) as { rows?: SearchAnalyticsRow[] };
  return json.rows || [];
}
