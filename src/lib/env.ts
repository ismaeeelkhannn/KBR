import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_TIMEZONE: z.string().min(1).default("Asia/Karachi"),
  APP_CURRENCY: z.string().min(3).max(3).default("PKR"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL zaroori hai")
    .refine((value) => value.startsWith("postgresql://"), {
      message: "DATABASE_URL 'postgresql://' se shuru hona chahiye",
    }),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET kam se kam 32 characters ka hona chahiye"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Environment configuration ghalat hai. .env file check karein:\n${details}`
    );
  }

  return parsed.data;
}

export const env: Env = loadEnv();
