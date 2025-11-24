import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const SUBS_FILE = path.join(DATA_DIR, "subscriptions.json");
const SESS_FILE = path.join(DATA_DIR, "sessionKeys.json");

function ensureFile(filePath: string, initial: unknown) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readJson<T>(filePath: string, initial: T): T {
  ensureFile(filePath, initial);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function writeJson<T>(filePath: string, data: T) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ---------- Subscription store ----------
export type SubscriptionRecord = {
  userId: string;
  accountAddress: string;
  status: "active" | "paused" | "inactive" | "pending";
  sessionKey?: string;       // public address
  entityId?: number;
  updatedAt: string;
};

type SubsShape = { byUser: Record<string, SubscriptionRecord> };

export function getSubscription(userId: string): SubscriptionRecord | undefined {
  const store = readJson<SubsShape>(SUBS_FILE, { byUser: {} });
  return store.byUser[userId];
}

export function upsertSubscription(rec: SubscriptionRecord) {
  const store = readJson<SubsShape>(SUBS_FILE, { byUser: {} });
  store.byUser[rec.userId] = { ...rec, updatedAt: new Date().toISOString() };
  writeJson(SUBS_FILE, store);
}

export function setSubscriptionStatus(userId: string, status: SubscriptionRecord["status"]) {
  const store = readJson<SubsShape>(SUBS_FILE, { byUser: {} });
  const rec = store.byUser[userId];
  if (!rec) return;
  rec.status = status;
  rec.updatedAt = new Date().toISOString();
  writeJson(SUBS_FILE, store);
}

export function cancelSubscription(userId: string) {
  const store = readJson<SubsShape>(SUBS_FILE, { byUser: {} });
  delete store.byUser[userId];
  writeJson(SUBS_FILE, store);
}

// ---------- Session key store ----------
// POC WARNING: raw privateKey persisted! Encrypt in production.
export type SessionKeyRecord = {
  userId: string;
  accountAddress: string;
  status: "pending" | "installed" | "revoked";
  publicKey: `0x${string}`;   // eoa address derived by privateKeyToAddress
  privateKey: `0x${string}`;  // raw private key (POC only)
  createdAt: string;
  updatedAt: string;
};

type SessionShape = { byUser: Record<string, SessionKeyRecord> };

export function getSessionKey(userId: string): SessionKeyRecord | undefined {
  const store = readJson<SessionShape>(SESS_FILE, { byUser: {} });
  return store.byUser[userId];
}

export function upsertSessionKey(rec: SessionKeyRecord) {
  const store = readJson<SessionShape>(SESS_FILE, { byUser: {} });
  store.byUser[rec.userId] = {
    ...rec,
    updatedAt: new Date().toISOString(),
  };
  writeJson(SESS_FILE, store);
}

export function setSessionKeyStatus(userId: string, status: SessionKeyRecord["status"]) {
  const store = readJson<SessionShape>(SESS_FILE, { byUser: {} });
  const rec = store.byUser[userId];
  if (!rec) return;
  rec.status = status;
  rec.updatedAt = new Date().toISOString();
  writeJson(SESS_FILE, store);
}

export function deleteSessionKey(userId: string) {
  const store = readJson<SessionShape>(SESS_FILE, { byUser: {} });
  delete store.byUser[userId];
  writeJson(SESS_FILE, store);
}
