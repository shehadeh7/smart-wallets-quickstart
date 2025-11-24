
import fs from "node:fs";
import path from "node:path";

export type SubscriptionRecord = {
  userId: string;
  accountAddress: string;
  status: "active" | "paused" | "inactive";
  sessionKey?: string;
  entityId?: number; // if you track module entity id
  updatedAt: string;
};

type StoreShape = {
  // keyed by userId
  byUser: Record<string, SubscriptionRecord>;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "subscriptions.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ byUser: {} } as StoreShape, null, 2));
  }
}

function readStore(): StoreShape {
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

function writeStore(store: StoreShape) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export function getSubscription(userId: string): SubscriptionRecord | undefined {
  const store = readStore();
  return store.byUser[userId];
}

export function upsertSubscription(rec: SubscriptionRecord) {
  const store = readStore();
  store.byUser[rec.userId] = { ...rec, updatedAt: new Date().toISOString() };
  writeStore(store);
}

export function setStatus(userId: string, status: SubscriptionRecord["status"]) {
  const store = readStore();
  const rec = store.byUser[userId];
  if (!rec) return;
  rec.status = status;
  rec.updatedAt = new Date().toISOString();
  writeStore(store);
}

export function cancelSubscription(userId: string) {
  const store = readStore();
  delete store.byUser[userId];
  writeStore(store);
}
