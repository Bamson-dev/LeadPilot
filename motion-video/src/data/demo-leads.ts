import {
  DEMO_SCENARIOS as SCENARIO_CONFIGS,
  generateDemoLeads,
  type DemoLead,
  type DemoScenarioConfig,
} from "../lib/generate-leads";

export type { DemoLead };

export type DemoScenario = {
  search: { business: string; location: string };
  resultCount: number;
  phaseFound: string;
  leads: DemoLead[];
};

function buildScenario(config: DemoScenarioConfig): DemoScenario {
  return {
    search: { business: config.business, location: config.location },
    resultCount: config.targetCount,
    phaseFound: `Found ${config.targetCount} businesses — loading more…`,
    leads: generateDemoLeads(config),
  };
}

export const DEMO_SCENARIOS: DemoScenario[] =
  SCENARIO_CONFIGS.map(buildScenario);

export const HERO_EXAMPLE_CHIPS = [
  "restaurants · Lagos",
  "hair salon · Ikeja",
  "real estate · Abuja",
];

export const FEATURES = [
  { title: "Live discovery", desc: "Prospects stream in with full street addresses" },
  { title: "Verified contacts", desc: "Phone, email, address & website in one view" },
  { title: "Pitch-ready export", desc: "CSV with addresses for outreach in seconds" },
];
