import type { Lead } from "@/types/lead";

export type DemoScenarioConfig = {
  id: string;
  business: string;
  location: string;
  targetCount: number;
  seed: number;
};

/** Mulberry32 — deterministic per scenario */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LAGOS_STREETS = [
  "Allen Ave, Ikeja",
  "Admiralty Way, Lekki Phase 1",
  "Akin Adesola St, Victoria Island",
  "Ozumba Mbadiwe Ave, VI",
  "Adeola Odeku St, Victoria Island",
  "Herbert Macaulay Way, Yaba",
  "Bode Thomas St, Surulere",
  "Isaac John St, Ikeja GRA",
  "Obafemi Awolowo Way, Ikeja",
  "Agungi Rd, Lekki",
  "Chevron Dr, Lekki",
  "Adetokunbo Ademola St, VI",
  "Kofo Abayomi St, VI",
  "Toyin St, Ikeja",
  "Opebi Rd, Ikeja",
  "Awolowo Rd, Ikoyi",
  "Kingsway Rd, Ikoyi",
  "Sanusi Fafunwa St, VI",
  "Marine Rd, Apapa",
  "Adeniran Ogunsanya St, Surulere",
];

const ABUJA_STREETS = [
  "Adetokunbo Ademola Cres, Wuse 2",
  "Aguiyi Ironsi St, Maitama",
  "Aminu Kano Cres, Wuse 2",
  "Gimbiya St, Garki",
  "Lobito Cres, Wuse 2",
  "Alex Ekwueme St, Jabi",
  "Ahmadu Bello Way, Central Area",
  "Yusuf Maitama Sule St, Maitama",
  "Constitution Ave, Central Area",
  "Independence Ave, Central Area",
  "Herbert Macaulay Way, Garki",
  "Port Harcourt Cres, Garki",
  "Jasper Okonkwo St, Wuse 2",
  "Monrovia St, Wuse 2",
  "Osun Cres, Maitama",
];

const RESTAURANT_PREFIX = [
  "The",
  "Royal",
  "Urban",
  "Lagos",
  "Golden",
  "Harbour",
  "Spice",
  "Coconut",
  "Palm",
  "Skyline",
  "Ocean",
  "Metro",
  "Crimson",
  "Saffron",
  "Velvet",
];

const RESTAURANT_SUFFIX = [
  "Kitchen",
  "Bistro",
  "Grill",
  "Lounge",
  "House",
  "Spot",
  "Table",
  "Garden",
  "Palace",
  "Eatery",
  "Canteen",
  "& Co",
  "Collective",
];

const SALON_PREFIX = [
  "Glamour",
  "Crown",
  "Silk",
  "Lush",
  "Fade",
  "Mane",
  "Velvet",
  "Royal",
  "Studio",
  "Elite",
  "Pure",
  "Glow",
  "Chic",
  "Urban",
  "Prime",
];

const SALON_SUFFIX = [
  "Locks",
  "Tresses",
  "Hair Studio",
  "Salon",
  "Barbers",
  "Cuts",
  "Styles",
  "Beauty Bar",
  "Hair Lounge",
  "Braids",
];

const ESTATE_PREFIX = [
  "Capital",
  "Prime",
  "GreenPark",
  "MetroNest",
  "Skyline",
  "CityGate",
  "Abuja",
  "Crown",
  "Summit",
  "Pinnacle",
  "Harbour",
  "Landmark",
  "Vertex",
  "Horizon",
  "Cedar",
];

const ESTATE_SUFFIX = [
  "Realty",
  "Properties",
  "Estates",
  "Homes",
  "Lettings",
  "Developers",
  "Realtors",
  "Housing",
  "Investments",
  "Partners",
];

const EMAIL_PREFIXES = [
  "hello",
  "info",
  "contact",
  "book",
  "reservations",
  "care",
  "team",
  "sales",
  "support",
  "enquiries",
];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 22);
}

function phone(rand: () => number): string {
  const prefixes = ["802", "803", "805", "807", "808", "809", "810", "811", "818", "901", "902", "903", "905", "915"];
  const p = pick(rand, prefixes);
  const a = String(Math.floor(rand() * 900) + 100);
  const b = String(Math.floor(rand() * 9000) + 1000);
  return `+234 ${p} ${a} ${b}`;
}

function rating(rand: () => number): number {
  return Math.round((3.8 + rand() * 1.2) * 10) / 10;
}

function businessName(
  rand: () => number,
  niche: "restaurant" | "salon" | "estate"
): string {
  if (niche === "restaurant") {
    return `${pick(rand, RESTAURANT_PREFIX)} ${pick(rand, RESTAURANT_SUFFIX)}`;
  }
  if (niche === "salon") {
    return `${pick(rand, SALON_PREFIX)} ${pick(rand, SALON_SUFFIX)}`;
  }
  return `${pick(rand, ESTATE_PREFIX)} ${pick(rand, ESTATE_SUFFIX)}`;
}

function nicheFromBusiness(business: string): "restaurant" | "salon" | "estate" {
  const b = business.toLowerCase();
  if (b.includes("hair") || b.includes("salon") || b.includes("barber")) return "salon";
  if (b.includes("real estate") || b.includes("property")) return "estate";
  return "restaurant";
}

function streetsForLocation(location: string): string[] {
  const loc = location.toLowerCase();
  if (loc.includes("abuja")) return ABUJA_STREETS;
  if (loc.includes("ikeja")) {
    return LAGOS_STREETS.filter((s) => s.includes("Ikeja") || s.includes("Allen") || s.includes("Opebi") || s.includes("Toyin") || s.includes("Obafemi"));
  }
  return LAGOS_STREETS;
}

function categoryLabel(
  rand: () => number,
  niche: "restaurant" | "salon" | "estate"
): string {
  if (niche === "salon")
    return pick(rand, ["Hair salon", "Barbershop", "Beauty studio", "Braiding studio"]);
  if (niche === "estate")
    return pick(rand, ["Estate agency", "Property sales", "Lettings", "Commercial property"]);
  return pick(rand, ["Restaurant", "Bistro", "Fast food", "Grill", "Lounge", "Cafe"]);
}

export function generateDemoLeads(config: DemoScenarioConfig): Lead[] {
  const rand = rng(config.seed);
  const niche = nicheFromBusiness(config.business);
  const streets = streetsForLocation(config.location);
  const usedNames = new Set<string>();
  const leads: Lead[] = [];

  for (let i = 0; i < config.targetCount; i++) {
    let name = businessName(rand, niche);
    let attempts = 0;
    while (usedNames.has(name) && attempts < 12) {
      name = `${businessName(rand, niche)} ${i + 1}`;
      attempts++;
    }
    usedNames.add(name);

    const street = pick(rand, streets);
    const num = Math.floor(rand() * 180) + 1;
    const address = `${num} ${street}`;
    const slug = slugify(name);
    const tld = rand() > 0.55 ? "ng" : "com";
    const email = `${pick(rand, EMAIL_PREFIXES)}@${slug}.${tld}`;
    const r = rating(rand);

    leads.push({
      id: `${config.id}-${i}`,
      search_id: config.id,
      business_name: name,
      phone: phone(rand),
      email,
      extracted_email: email,
      generated_email: null,
      email_source: "extracted",
      website: rand() > 0.35 ? `www.${slug}.${tld}` : null,
      address,
      rating: r,
      reviews_count: Math.floor(rand() * 420) + 8,
      category: categoryLabel(rand, niche),
      google_maps_url: null,
      created_at: new Date().toISOString(),
    });
  }

  return leads;
}

/** Counter climbs 0 → target in `durationMs` with accelerating ease-in */
export function acceleratingCount(
  elapsedMs: number,
  target: number,
  durationMs = 9000
): number {
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const eased = t * t * (3 - 2 * t);
  return Math.min(target, Math.floor(eased * target));
}

export const DEMO_SCENARIOS: DemoScenarioConfig[] = [
  {
    id: "demo-restaurants-lagos",
    business: "restaurants",
    location: "Lagos",
    targetCount: 156,
    seed: 4102,
  },
  {
    id: "demo-salon-ikeja",
    business: "hair salon",
    location: "Ikeja, Lagos",
    targetCount: 112,
    seed: 8831,
  },
  {
    id: "demo-estate-abuja",
    business: "real estate agency",
    location: "Abuja",
    targetCount: 87,
    seed: 2294,
  },
];

export const DEMO_TIMING = {
  charMs: 68,
  /** First row appears as location starts typing (same moment as scan) */
  scanLeadStartMs: 0,
  pauseBetweenSearchesMs: 4500,
  counterRampMs: 14000,
  rowIntervalMs: 550,
  /** End card hold before replay hint */
  lifetimeOfferMs: 7000,
} as const;
