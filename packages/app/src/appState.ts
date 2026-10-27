import type { Business, Session } from "@auxo/core";
import { getRepositories } from "./db/repositories.js";

const BUSINESS_KEY = "business";
const SESSION_KEY = "session";

export async function getBusiness(): Promise<Business | null> {
  const raw = await getRepositories().settings.get(BUSINESS_KEY);
  return raw ? (JSON.parse(raw) as Business) : null;
}

export async function setBusiness(business: Business): Promise<void> {
  await getRepositories().settings.set(BUSINESS_KEY, JSON.stringify(business));
}

export async function getSession(): Promise<Session | null> {
  const raw = await getRepositories().settings.get(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export async function setSession(session: Session | null): Promise<void> {
  if (session) {
    await getRepositories().settings.set(SESSION_KEY, JSON.stringify(session));
  } else {
    await getRepositories().settings.delete(SESSION_KEY);
  }
}
