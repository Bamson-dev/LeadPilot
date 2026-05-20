import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_KEY: z.string().min(20),
    SCRAPER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
    FRONTEND_URL: z.string().url(),
    CORS_ORIGINS: z.string().optional(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (data.FRONTEND_URL.includes("localhost")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "FRONTEND_URL must not use localhost in production",
          path: ["FRONTEND_URL"],
        });
      }
      if (data.SUPABASE_SERVICE_KEY.includes("anon")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SUPABASE_SERVICE_KEY must be the service_role key, not anon",
          path: ["SUPABASE_SERVICE_KEY"],
        });
      }
    }
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
      `Invalid environment configuration:\n${formatZodError(parsed.error)}\n\nRequired: SUPABASE_URL, SUPABASE_SERVICE_KEY, FRONTEND_URL`
    );
  }
  return parsed.data;
}

export function getEnv(): Env {
  if (!cachedEnv) cachedEnv = loadEnv();
  return cachedEnv;
}

export function getCorsOrigins(): string[] {
  const env = getEnv();
  const extra =
    env.CORS_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? [];
  const origins = new Set([env.FRONTEND_URL, ...extra]);
  return [...origins];
}
