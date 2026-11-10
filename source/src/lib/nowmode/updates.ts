import { APP_VERSION } from "./version";

export function parseVersion(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True when the published version is strictly newer than the one in this build. */
export function isNewerVersion(remote: string, local: string = APP_VERSION): boolean {
  const next = parseVersion(remote);
  const here = parseVersion(local);
  if (!next || !here) return false;
  for (let i = 0; i < 3; i += 1) {
    if (next[i] !== here[i]) return next[i] > here[i];
  }
  return false;
}

/** Prefer the platform field. Fall back to the shared version. Ignore anything else. */
export function remoteVersion(payload: unknown, platform: "web" | "android" | "ios"): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const specific = record[platform];
  if (typeof specific === "string" && parseVersion(specific)) return specific;
  if (typeof record.version === "string" && parseVersion(record.version)) return record.version;
  return null;
}
