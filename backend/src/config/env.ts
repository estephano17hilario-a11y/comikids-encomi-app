import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Redis
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  // OpenRouter & Gemini AI Engines
  OPENROUTER_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('qwen/qwen3.7-flash'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),





  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Evolution API
  EVOLUTION_API_URL: z.string().default('http://127.0.0.1:8080'),
  EVOLUTION_API_KEY: z.string().min(1, 'EVOLUTION_API_KEY is required'),
  EVOLUTION_INSTANCE_NAME: z.string().default('comikids_whatsapp'),
  EVOLUTION_INSTANCE: z.string().optional(),

  // Shalom
  SHALOM_API_URL: z.string().optional(),
  SHALOM_API_KEY: z.string().optional(),
  SHALOM_CLIENT_ID: z.string().optional(),
  SHALOM_CLIENT_SECRET: z.string().optional(),
});


const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  EVOLUTION_INSTANCE_NAME: parsedEnv.EVOLUTION_INSTANCE || parsedEnv.EVOLUTION_INSTANCE_NAME,
};

