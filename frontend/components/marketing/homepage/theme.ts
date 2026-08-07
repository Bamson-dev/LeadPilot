export const C = {
  bg: "var(--lt-bg)",
  bgSecondary: "var(--lt-surface)",
  bgCard: "var(--lt-surface-2)",
  bgElevated: "var(--lt-surface-3)",
  border: "var(--lt-border)",
  purple: "var(--lt-accent)",
  purpleLight: "var(--lt-accent-soft)",
  purpleMuted: "var(--lt-accent-soft)",
  green: "var(--lt-success)",
  red: "var(--lt-danger)",
  orange: "var(--lt-warning)",
  text: "var(--lt-text)",
  muted: "var(--lt-text-muted)",
} as const;

export const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const CHECKOUT = "/checkout";
export const FREETRIAL = "https://www.leadthur.com/freetrial";
export const LOGIN = "/activate";

export const TAP_TARGET = {
  minHeight: 48,
  minWidth: 48,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} as const;
