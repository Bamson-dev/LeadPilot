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
    lower.includes("benin") ||
    lower.includes("kaduna") ||
    lower.includes("delta")
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
    lower.includes("denver")
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
    return (
      cleanPhone.startsWith("+1") ||
      cleanPhone.startsWith("1") ||
      /^\d{10}$/.test(cleanPhone)
    );
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
