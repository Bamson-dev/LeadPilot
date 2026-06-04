export interface DemoContact {
  name: string;
  phone: string;
  email: string;
  address: string;
  rating: number;
  website: string;
  category: string;
  country: string;
}

const phoneFormats: Record<string, { prefix: string[]; format: (p: string) => string }> = {
  nigeria: {
    prefix: [
      "0801", "0802", "0803", "0805", "0806", "0807", "0808", "0809",
      "0810", "0811", "0812", "0813", "0814", "0815", "0816", "0817",
      "0901", "0902", "0903", "0904", "0905", "0906", "0907", "0908",
    ],
    format: (p) => `${p}${Math.floor(Math.random() * 9000000 + 1000000)}`,
  },
  ghana: {
    prefix: ["+233 24", "+233 20", "+233 27", "+233 54", "+233 55", "+233 57"],
    format: (p) =>
      `${p} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000 + 1000)}`,
  },
  kenya: {
    prefix: ["+254 70", "+254 71", "+254 72", "+254 73", "+254 74", "+254 75"],
    format: (p) => `${p}${Math.floor(Math.random() * 9000000 + 1000000)}`,
  },
  southafrica: {
    prefix: [
      "+27 60", "+27 61", "+27 62", "+27 63", "+27 71", "+27 72", "+27 73", "+27 74",
      "+27 81", "+27 82", "+27 83",
    ],
    format: (p) =>
      `${p} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000 + 1000)}`,
  },
  uk: {
    prefix: ["+44 20", "+44 121", "+44 131", "+44 141", "+44 151", "+44 161"],
    format: (p) =>
      `${p} ${Math.floor(Math.random() * 9000 + 1000)} ${Math.floor(Math.random() * 9000 + 1000)}`,
  },
  usa: {
    prefix: [
      "+1 212", "+1 310", "+1 404", "+1 415", "+1 512", "+1 602",
      "+1 646", "+1 713", "+1 718", "+1 786", "+1 312", "+1 617",
    ],
    format: (p) =>
      `${p} ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
  },
  canada: {
    prefix: ["+1 416", "+1 437", "+1 647", "+1 604", "+1 778", "+1 403", "+1 514", "+1 438"],
    format: (p) =>
      `${p} ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
  },
  uae: {
    prefix: [
      "+971 2", "+971 3", "+971 4", "+971 6", "+971 7", "+971 50", "+971 52", "+971 55",
      "+971 56",
    ],
    format: (p) =>
      `${p} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000 + 1000)}`,
  },
  india: {
    prefix: [
      "+91 98", "+91 97", "+91 96", "+91 95", "+91 94", "+91 93", "+91 90", "+91 89", "+91 88",
    ],
    format: (p) => `${p}${Math.floor(Math.random() * 90000000 + 10000000)}`,
  },
  australia: {
    prefix: ["+61 2", "+61 3", "+61 4", "+61 7", "+61 8"],
    format: (p) =>
      `${p} ${Math.floor(Math.random() * 9000 + 1000)} ${Math.floor(Math.random() * 9000 + 1000)}`,
  },
  default: {
    prefix: ["+1", "+44", "+33", "+49", "+34"],
    format: (p) =>
      `${p} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000 + 1000)}`,
  },
};

const addressData: Record<
  string,
  { streets: string[]; areas: string[]; suffix: string[] }
> = {
  nigeria: {
    streets: [
      "Adeola Odeku", "Ahmadu Bello Way", "Broad Street", "Marina", "Allen Avenue",
      "Awolowo Road", "Bode Thomas", "Toyin Street", "Opebi Road", "Agege Motor Road",
      "Lagos-Abeokuta Expressway", "Apapa Road", "Old Ojo Road", "Badagry Express",
      "Nnamdi Azikiwe", "Yakubu Gowon", "IBB Way", "Shehu Shagari Way",
    ],
    areas: [
      "Victoria Island", "Lekki", "Ikeja", "Surulere", "Yaba", "Ikoyi",
      "Ajah", "Gbagada", "Magodo", "Maryland", "Wuse", "Garki", "Maitama",
      "Asokoro", "Gwarinpa", "GRA", "Old GRA", "Rumuola", "Diobu",
      "Sabon Gari", "Nassarawa", "Bodija", "Mokola", "Dugbe", "Ring Road",
    ],
    suffix: ["Street", "Avenue", "Road", "Close", "Crescent", "Drive", "Way"],
  },
  ghana: {
    streets: [
      "Accra Road", "Liberation Road", "Ring Road", "Spintex Road", "Tema Motorway",
      "Kwame Nkrumah Avenue", "Oxford Street", "Kanda Highway", "Graphic Road",
    ],
    areas: [
      "Osu", "Labone", "Airport Residential", "East Legon", "Cantonments",
      "Dzorwulu", "Roman Ridge", "Adabraka", "Asylum Down", "North Ridge",
      "Kumasi Central", "Adum", "Nhyiaeso", "Suame", "Tafo",
    ],
    suffix: ["Street", "Road", "Avenue", "Lane", "Close"],
  },
  kenya: {
    streets: [
      "Moi Avenue", "Kenyatta Avenue", "Haile Selassie Avenue", "Uhuru Highway",
      "Ngong Road", "Kiambu Road", "Thika Road", "Waiyaki Way", "Jogoo Road",
      "Mombasa Road", "Langata Road", "Karen Road",
    ],
    areas: [
      "Westlands", "Kilimani", "Lavington", "Karen", "Gigiri", "Runda",
      "Parklands", "Upperhill", "CBD", "Industrial Area", "Mombasa CBD",
      "Nyali", "Bamburi", "Kisumu Central",
    ],
    suffix: ["Street", "Road", "Avenue", "Lane", "Close", "Drive"],
  },
  southafrica: {
    streets: [
      "Jan Smuts Avenue", "William Nicol Drive", "Rivonia Road", "Oxford Road",
      "Louis Botha Avenue", "Soweto Highway", "Main Road", "Long Street",
      "Bree Street", "Adderley Street", "Commissioner Street",
    ],
    areas: [
      "Sandton", "Rosebank", "Morningside", "Midrand", "Centurion",
      "Cape Town CBD", "Sea Point", "Green Point", "Claremont", "Durban CBD",
      "Umhlanga", "Ballito", "Pretoria East", "Menlyn",
    ],
    suffix: ["Street", "Avenue", "Road", "Drive", "Boulevard", "Crescent"],
  },
  uk: {
    streets: [
      "High Street", "Church Road", "Park Lane", "Victoria Road", "King Street",
      "Queen Street", "Market Street", "Station Road", "Manor Road", "The Broadway",
      "Oxford Street", "Regent Street", "Baker Street", "Bond Street",
    ],
    areas: [
      "City Centre", "West End", "East End", "Shoreditch", "Canary Wharf",
      "Mayfair", "Kensington", "Chelsea", "Notting Hill", "Camden",
      "Northern Quarter", "Digbeth", "Merchant City",
    ],
    suffix: ["Street", "Road", "Avenue", "Lane", "Place", "Gardens", "Close"],
  },
  usa: {
    streets: [
      "Main Street", "Oak Avenue", "Maple Drive", "Washington Boulevard",
      "Lincoln Avenue", "Park Street", "Broadway", "Madison Avenue",
      "Sunset Boulevard", "Hollywood Boulevard", "Rodeo Drive",
      "Michigan Avenue", "Peachtree Road", "Market Street",
    ],
    areas: [
      "Downtown", "Midtown", "Uptown", "West Side", "East Side",
      "Financial District", "Arts District", "Old Town", "SoHo", "NoHo",
      "Beverly Hills", "Santa Monica", "Buckhead", "River North",
    ],
    suffix: ["Street", "Avenue", "Boulevard", "Drive", "Road", "Lane", "Way"],
  },
  uae: {
    streets: [
      "Sheikh Zayed Road", "Al Wasl Road", "Jumeirah Beach Road",
      "Airport Road", "Corniche Road", "Khalifa Street", "Hamdan Street",
      "Electra Street", "Muroor Road", "Salaam Street",
    ],
    areas: [
      "Dubai Marina", "Downtown Dubai", "Business Bay", "DIFC", "JLT",
      "Al Barsha", "Deira", "Bur Dubai", "Abu Dhabi CBD", "Al Reem Island",
      "Al Khalidiyah", "Tourist Club Area", "Khalidiyah",
    ],
    suffix: ["Street", "Road", "Avenue", "Boulevard"],
  },
  default: {
    streets: ["Main Street", "High Street", "Central Avenue", "Park Road", "Commercial Street"],
    areas: ["City Centre", "Downtown", "Business District", "Old Town", "New District"],
    suffix: ["Street", "Avenue", "Road", "Boulevard", "Drive"],
  },
};

const businessNameComponents: Record<string, { adjectives: string[]; suffixes: string[] }> = {
  nigeria: {
    adjectives: [
      "Premier", "Classic", "Royal", "Golden", "Prime", "Elite", "Top",
      "Best", "Quality", "Express", "Ace", "Star", "Crown", "Diamond",
      "Pearl", "Sunrise", "Excellence", "Prestige", "Heritage", "Legacy",
    ],
    suffixes: ["Nigeria", "Global", "International", "Limited", "Enterprises", "Services"],
  },
  ghana: {
    adjectives: [
      "Accra", "Kumasi", "Gold Coast", "Ashanti", "Volta", "Premier",
      "Royal", "Classic", "Elite", "Star", "Quality", "Golden",
    ],
    suffixes: ["Ghana", "GH", "International", "Limited", "Services", "Enterprises"],
  },
  kenya: {
    adjectives: [
      "Nairobi", "Savanna", "Safari", "East African", "Serengeti", "Kilimanjaro",
      "Premier", "Royal", "Elite", "Star", "Golden", "Quality",
    ],
    suffixes: ["Kenya", "KE", "East Africa", "Limited", "Services", "Enterprises"],
  },
  uk: {
    adjectives: [
      "Royal", "Premier", "Classic", "Heritage", "Imperial", "Crown",
      "British", "London", "Manchester", "Edinburgh", "Quality", "Elite",
    ],
    suffixes: ["Ltd", "Group", "UK", "Services", "International", "Associates"],
  },
  usa: {
    adjectives: [
      "American", "Premier", "Elite", "Pro", "Best", "Top", "Quality",
      "Express", "National", "Federal", "Metro", "Urban", "Pacific", "Atlantic",
    ],
    suffixes: ["Inc", "LLC", "Corp", "Services", "Group", "Solutions", "Associates"],
  },
  uae: {
    adjectives: [
      "Dubai", "Emirates", "Gulf", "Arabian", "Desert", "Pearl", "Golden",
      "Royal", "Premier", "Elite", "Luxury", "International",
    ],
    suffixes: ["LLC", "FZE", "International", "Group", "Services", "Trading"],
  },
  default: {
    adjectives: ["Premier", "Classic", "Royal", "Elite", "Star", "Quality", "Express"],
    suffixes: ["International", "Group", "Services", "Ltd", "Inc"],
  },
};

const emailDomains: Record<string, string[]> = {
  nigeria: ["gmail.com", "yahoo.com", "outlook.com", "businessmail.ng", "company.ng"],
  ghana: ["gmail.com", "yahoo.com", "outlook.com", "business.gh", "company.com.gh"],
  kenya: ["gmail.com", "yahoo.com", "outlook.com", "business.ke", "company.co.ke"],
  southafrica: ["gmail.com", "yahoo.com", "outlook.com", "business.co.za", "company.co.za"],
  uk: ["gmail.com", "outlook.com", "business.co.uk", "company.co.uk", "yahoo.co.uk"],
  usa: ["gmail.com", "outlook.com", "yahoo.com", "company.com", "business.us"],
  uae: ["gmail.com", "outlook.com", "yahoo.com", "business.ae", "company.ae"],
  default: ["gmail.com", "yahoo.com", "outlook.com", "company.com", "business.com"],
};

function detectCountry(city: string): string {
  const cityLower = city.toLowerCase();
  if (
    cityLower.includes("lagos") ||
    cityLower.includes("abuja") ||
    cityLower.includes("port harcourt") ||
    cityLower.includes("kano") ||
    cityLower.includes("ibadan") ||
    cityLower.includes("enugu") ||
    cityLower.includes("nigeria")
  ) {
    return "nigeria";
  }
  if (cityLower.includes("accra") || cityLower.includes("kumasi") || cityLower.includes("ghana")) {
    return "ghana";
  }
  if (cityLower.includes("nairobi") || cityLower.includes("mombasa") || cityLower.includes("kenya")) {
    return "kenya";
  }
  if (
    cityLower.includes("johannesburg") ||
    cityLower.includes("cape town") ||
    cityLower.includes("durban") ||
    cityLower.includes("pretoria") ||
    cityLower.includes("south africa")
  ) {
    return "southafrica";
  }
  if (
    cityLower.includes("london") ||
    cityLower.includes("manchester") ||
    cityLower.includes("birmingham") ||
    cityLower.includes("edinburgh") ||
    cityLower.includes("uk") ||
    cityLower.includes("united kingdom")
  ) {
    return "uk";
  }
  if (
    cityLower.includes("new york") ||
    cityLower.includes("los angeles") ||
    cityLower.includes("chicago") ||
    cityLower.includes("houston") ||
    cityLower.includes("atlanta") ||
    cityLower.includes("usa") ||
    cityLower.includes("united states")
  ) {
    return "usa";
  }
  if (
    cityLower.includes("dubai") ||
    cityLower.includes("abu dhabi") ||
    cityLower.includes("uae") ||
    cityLower.includes("emirates")
  ) {
    return "uae";
  }
  if (
    cityLower.includes("sydney") ||
    cityLower.includes("melbourne") ||
    cityLower.includes("brisbane") ||
    cityLower.includes("australia")
  ) {
    return "australia";
  }
  if (
    cityLower.includes("toronto") ||
    cityLower.includes("vancouver") ||
    cityLower.includes("montreal") ||
    cityLower.includes("canada")
  ) {
    return "canada";
  }
  if (
    cityLower.includes("mumbai") ||
    cityLower.includes("delhi") ||
    cityLower.includes("bangalore") ||
    cityLower.includes("india")
  ) {
    return "india";
  }
  return "default";
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhone(country: string): string {
  const format = phoneFormats[country] || phoneFormats.default;
  const prefix = randomItem(format.prefix);
  return format.format(prefix);
}

function generateEmail(businessName: string, country: string): string {
  const domains = emailDomains[country] || emailDomains.default;
  const clean = businessName.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 12);
  const suffixes = ["", "ng", "ltd", "biz", "1", "2", "hq", "official"];
  return `${clean}${randomItem(suffixes)}@${randomItem(domains)}`;
}

function generateBusinessName(type: string, area: string, country: string): string {
  const components = businessNameComponents[country] || businessNameComponents.default;
  const useArea = Math.random() > 0.6;
  const useAdjective = Math.random() > 0.4;

  if (useArea) {
    return `${area} ${type}`;
  }
  if (useAdjective) {
    return `${randomItem(components.adjectives)} ${type}`;
  }
  return `${randomItem(components.adjectives)} ${type} ${randomItem(components.suffixes)}`;
}

function generateAddress(country: string, city: string): string {
  const data = addressData[country] || addressData.default;
  const streetNum = Math.floor(Math.random() * 300 + 1);
  const area = randomItem(data.areas);
  return `${streetNum} ${randomItem(data.streets)} ${randomItem(data.suffix)}, ${area}, ${city}`;
}

function generateRating(): number {
  const ratings = [
    3.6, 3.7, 3.8, 3.9, 4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.0,
  ];
  return randomItem(ratings);
}

export function generateDemoContacts(
  businessType: string,
  city: string,
  count: number
): DemoContact[] {
  const country = detectCountry(city);
  const contacts: DemoContact[] = [];
  const areas = (addressData[country] || addressData.default).areas;

  for (let i = 0; i < count; i++) {
    const area = randomItem(areas);
    const type = businessType || "Business";
    const businessName = generateBusinessName(type, area, country);

    contacts.push({
      name: businessName,
      phone: generatePhone(country),
      email: generateEmail(businessName, country),
      address: generateAddress(country, city),
      rating: generateRating(),
      website: `www.${businessName.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 15)}.com`,
      category: type,
      country,
    });
  }

  return contacts;
}
