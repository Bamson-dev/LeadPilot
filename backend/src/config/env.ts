import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SCRAPER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatZodError(parsed.error)}\n\nRequired: SUPABASE_URL, SUPABASE_SERVICE_KEY`
    );
  }
  return parsed.data;
}

export function getEnv(): Env {
  if (!cachedEnv) cachedEnv = loadEnv();
  return cachedEnv;
}
