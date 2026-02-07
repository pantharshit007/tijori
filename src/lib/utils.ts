import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ClassValue } from "clsx";

import type { ParsedVariable } from "./types";
import {
  SHARE_PASSCODE_MAX_LENGTH,
  SHARE_PASSCODE_MIN_LENGTH,
  SHARE_PASSCODE_REGEX,
} from "./constants";

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs));
}

/**
 * Parse bulk input text into variable name-value pairs.
 * Supports formats: KEY=VALUE, export KEY=VALUE, KEY="VALUE", KEY='VALUE'
 * Lines starting with # are treated as comments and skipped.
 */
export function parseBulkInput(input: string, maxNameLength?: number): ParsedVariable[] {
  const lines = input.split("\n").filter((line) => line.trim());
  const results: ParsedVariable[] = [];

  for (const line of lines) {
    let trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (trimmed.toLowerCase().startsWith("export ")) {
      trimmed = trimmed.slice(7).trim();
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      results.push({ name: trimmed, value: "", error: "Missing '=' separator" });
      continue;
    }

    const name = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!name) {
      results.push({ name: "", value, error: "Empty variable name" });
      continue;
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      results.push({ name, value, error: "Invalid variable name format" });
      continue;
    }

    if (maxNameLength && name.length > maxNameLength) {
      results.push({ name, value, error: `Name too long (max ${maxNameLength})` });
      continue;
    }

    results.push({ name, value });
  }

  return results;
}

/**
 * Convert variables to exportable format (KEY="VALUE" per line).
 * Filters out empty name/value pairs.
 */
export function variablesToExport(vars: { name: string; value: string }[]): string {
  return vars
    .filter((v) => v.name.trim())
    .map((v) => `${v.name}="${v.value}"`)
    .join("\n");
}

export function getSharePasscodeError(passcode: string): string | null {
  if (!passcode.trim()) {
    return "Passcode is required";
  }

  if (passcode.length < SHARE_PASSCODE_MIN_LENGTH) {
    return `Passcode must be at least ${SHARE_PASSCODE_MIN_LENGTH} characters`;
  }

  if (passcode.length > SHARE_PASSCODE_MAX_LENGTH) {
    return `Passcode must be ${SHARE_PASSCODE_MAX_LENGTH} characters or fewer`;
  }

  if (!SHARE_PASSCODE_REGEX.test(passcode)) {
    return "Passcode can contain only letters and numbers";
  }

  return null;
}
