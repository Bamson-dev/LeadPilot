import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_KEY: z.string().min(20),
    SCRAPER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(5),
    FRONTEND_URL: z.string().url(),
    CORS_ORIGINS: z.string().optional(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    ADMIN_EMAIL: z.string().email(),
    ADMIN_PASSWORD: z.string().min(8),
    JWT_SECRET: z.string().min(32),
    LIFETIME_ACCESS_PRICE: z.coerce.number().int().positive().default(3_000_000),
    PAYSTACK_SECRET_KEY: z.string().optional(),
    FLUTTERWAVE_SECRET_KEY: z.string().optional(),
    FLUTTERWAVE_SECRET_HASH: z.string().optional(),
    BREVO_API_KEY: z.string().optional(),
    BREVO_SENDER_EMAIL: z.string().email().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
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
      `Invalid environment configuration:\n${formatZodError(parsed.error)}\n\nRequired: SUPABASE_URL, SUPABASE_SERVICE_KEY, FRONTEND_URL, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET`
    );
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) cachedEnv = loadEnv();
  return cachedEnv;
}

/** Lazy config accessor for services (call after loadEnv). */
export const config = {
  get ADMIN_EMAIL() {
    return getEnv().ADMIN_EMAIL;
  },
  get ADMIN_PASSWORD() {
    return getEnv().ADMIN_PASSWORD;
  },
  get JWT_SECRET() {
    return getEnv().JWT_SECRET;
  },
  get LIFETIME_ACCESS_PRICE() {
    return getEnv().LIFETIME_ACCESS_PRICE;
  },
  get PAYSTACK_SECRET_KEY() {
    return getEnv().PAYSTACK_SECRET_KEY ?? "";
  },
  get FLUTTERWAVE_SECRET_KEY() {
    return getEnv().FLUTTERWAVE_SECRET_KEY ?? "";
  },
  get FLUTTERWAVE_SECRET_HASH() {
    return getEnv().FLUTTERWAVE_SECRET_HASH ?? "";
  },
  get BREVO_API_KEY() {
    return getEnv().BREVO_API_KEY ?? "";
  },
  get BREVO_SENDER_EMAIL() {
    return getEnv().BREVO_SENDER_EMAIL ?? "access@leadthur.com";
  },
  get FRONTEND_URL() {
    return getEnv().FRONTEND_URL;
  },
};

export function getCorsOrigins(): string[] {
  const env = getEnv();
  const extra =
    env.CORS_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? [];
  const origins = new Set([env.FRONTEND_URL, ...extra]);
  return [...origins];
}
