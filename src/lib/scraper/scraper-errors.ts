/** User-safe message — never expose Playwright call logs */
export function formatScraperError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.split("Call log:")[0]?.split("\n")[0]?.trim() ?? raw;
  const lower = msg.toLowerCase();

  if (
    lower.includes("err_name_not_resolved") ||
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo")
  ) {
    return "Can't reach the discovery network (DNS/network). Check your internet connection, disable VPN if enabled, and try again.";
  }

  if (
    lower.includes("err_internet_disconnected") ||
    lower.includes("network is offline") ||
    lower.includes("econnrefused")
  ) {
    return "No internet connection. Connect to the network and try your search again.";
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("etimedout")
  ) {
    return "Discovery took too long to respond. Try again in a moment or use a simpler location.";
  }

  if (lower.includes("err_connection_reset") || lower.includes("econnreset")) {
    return "Connection was interrupted. Please try again.";
  }

  if (lower.includes("err_connection_closed")) {
    return "Connection closed unexpectedly. Please try again.";
  }

  if (lower.includes("playwright") && lower.includes("chromium")) {
    return "Browser not ready. Run: npm run setup — then try again.";
  }

  if (lower.includes("net::err_")) {
    return "Couldn't load business listings. Check your connection and try again.";
  }

  if (lower.includes("no businesses found")) {
    return msg;
  }

  if (lower.includes("browser failed to start")) {
    return msg;
  }

  if (msg.length > 180) {
    return "Search failed. Check your internet connection and try again.";
  }

  return msg;
}
