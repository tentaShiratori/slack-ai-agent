import { env } from "./env.js";

export const isDevelopment = env.VERCEL_ENV === "development";
