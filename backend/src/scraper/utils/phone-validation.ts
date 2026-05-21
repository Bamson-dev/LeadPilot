export function getExpectedCountryCode(location: string): string | null {
  const lower = location.toLowerCase();

  if (
    lower.includes("nigeria") ||
    lower.includes("lagos") ||
    lower.includes("abuja") ||
    lower.includes("port harcourt") ||
    lower.includes("kano") ||
    lower.includes("ibadan") ||
    lower.includes("enugu") ||
    lower.includes("benin city") ||
    lower.includes("kaduna") ||
    lower.includes("delta state") ||
    lower.includes("delta, nigeria") ||
    lower.includes("delta nigeria") ||
    (lower.includes("delta") && lower.includes("nigeria"))
  ) {
    return "+234";
  }

  if (
    lower.includes("california") ||
    lower.includes("new york") ||
    lower.includes("texas") ||
    lower.includes("florida") ||
    lower.includes("illinois") ||
    lower.includes("usa") ||
    lower.includes("united states") ||
    lower.includes("los angeles") ||
    lower.includes("chicago") ||
    lower.includes("houston") ||
    lower.includes("miami") ||
    lower.includes("seattle") ||
    lower.includes("boston") ||
    lower.includes("atlanta") ||
    lower.includes("denver") ||
    lower.includes("san francisco") ||
    lower.includes("san diego") ||
    lower.includes("sacramento") ||
    lower.includes("oakland") ||
    lower.includes("fresno") ||
    lower.includes("oakhurst") ||
    lower.includes("arizona") ||
    lower.includes("colorado") ||
    lower.includes("nevada") ||
    lower.includes("oregon") ||
    lower.includes("washington state") ||
    lower.includes("pennsylvania") ||
    lower.includes("ohio") ||
    lower.includes("michigan") ||
    lower.includes("georgia") ||
    lower.includes("north carolina") ||
    lower.includes("virginia")
  ) {
    return "+1";
  }

  if (
    lower.includes("london") ||
    lower.includes("manchester") ||
    lower.includes("birmingham") ||
    lower.includes("uk") ||
    lower.includes("united kingdom") ||
    lower.includes("england") ||
    lower.includes("scotland") ||
    lower.includes("wales") ||
    lower.includes("liverpool")
  ) {
    return "+44";
  }

  if (
    lower.includes("ghana") ||
    lower.includes("accra") ||
    lower.includes("kumasi")
  ) {
    return "+233";
  }

  if (
    lower.includes("kenya") ||
    lower.includes("nairobi") ||
    lower.includes("mombasa")
  ) {
    return "+254";
  }

  if (
    lower.includes("south africa") ||
    lower.includes("johannesburg") ||
    lower.includes("cape town") ||
    lower.includes("durban")
  ) {
    return "+27";
  }

  if (
    lower.includes("dubai") ||
    lower.includes("abu dhabi") ||
    lower.includes("uae") ||
    lower.includes("emirates")
  ) {
    return "+971";
  }

  if (
    lower.includes("canada") ||
    lower.includes("toronto") ||
    lower.includes("vancouver") ||
    lower.includes("montreal") ||
    lower.includes("calgary")
  ) {
    return "+1";
  }

  if (
    lower.includes("australia") ||
    lower.includes("sydney") ||
    lower.includes("melbourne") ||
    lower.includes("brisbane") ||
    lower.includes("perth")
  ) {
    return "+61";
  }

  return null;
}

export function isValidPhoneForLocation(
  phone: string,
  location: string
): boolean {
  if (!phone) return false;

  const expectedCode = getExpectedCountryCode(location);
  if (!expectedCode) return true;

  const cleanPhone = phone.replace(/[\s().-]/g, "");

  if (expectedCode === "+1") {
    const digits = cleanPhone.replace(/\D/g, "");
    if (digits.length === 10) return true;
    if (digits.length === 11 && digits.startsWith("1")) return true;
    return cleanPhone.startsWith("+1");
  }

  return cleanPhone.startsWith(expectedCode);
}

/** Normalize a tel: URI or panel phone button value only — no page-wide scan. */
export function normalizePanelPhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  let phone = raw.trim();
  phone = phone.replace(/^tel:/i, "").trim();
  try {
    phone = decodeURIComponent(phone);
  } catch {
    /* keep raw */
  }
  phone = phone.split(";")[0]?.split(",")[0]?.trim() ?? "";
  if (!phone || phone.length < 7) return null;

  return phone.replace(/\s+/g, " ").trim();
}

const PHONE_IN_TEXT =
  /(\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\d{3}[\s.-]\d{3}[\s.-]\d{4})/;

export function extractPhoneFromLabel(label: string): string | null {
  if (!label?.trim()) return null;
  const match = label.match(PHONE_IN_TEXT);
  if (!match?.[1]) return null;
  return normalizePanelPhone(match[1]);
}

/** Format phone for storage; normalize US/CA 10-digit to +1 when location matches. */
export function normalizePhoneForLocation(
  raw: string | null | undefined,
  location: string
): string | null {
  let phone = normalizePanelPhone(raw);
  if (!phone) return null;

  const expected = getExpectedCountryCode(location);
  if (expected === "+1") {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      phone = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      phone = `+${digits}`;
    }
  }

  if (!isValidPhoneForLocation(phone, location)) {
    return null;
  }

  return phone;
}
