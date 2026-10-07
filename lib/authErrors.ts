import { NextResponse } from "next/server";
import { AppConfigurationError, cleanEnvValue } from "./appUrl";

export function requireEnv(...names: string[]) {
  const missing = names.filter(name => !cleanEnvValue(process.env[name]));
  if (missing.length) throw new AppConfigurationError(`Missing env: ${missing.join(", ")}`);
}

export function authError(error: unknown, fallback = "Authentication failed. Please try again.") {
  const message = error instanceof Error && /^(Missing env:|Invalid configuration:)/.test(error.message) ? error.message : error instanceof AppConfigurationError ? error.message : error instanceof SyntaxError ? "Invalid JSON request." : fallback;
  console.error("[AUTH_ERROR]", message);
  return NextResponse.json({ error: message }, { status: error instanceof SyntaxError ? 400 : 500 });
}
