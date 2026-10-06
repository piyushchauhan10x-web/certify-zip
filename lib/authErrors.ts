import { NextResponse } from "next/server";
import { AppConfigurationError } from "./appUrl";

export function requireEnv(...names: string[]) {
  const missing = names.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new AppConfigurationError(`Missing env: ${missing.join(", ")}`);
}

export function authError(error: unknown, fallback = "Authentication failed. Please try again.") {
  const message = error instanceof AppConfigurationError ? error.message : error instanceof SyntaxError ? "Invalid JSON request." : fallback;
  console.error("[AUTH_ERROR]", message);
  return NextResponse.json({ error: message }, { status: error instanceof SyntaxError ? 400 : 500 });
}
