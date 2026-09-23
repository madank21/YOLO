import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type JsonAnnotation = {
  id: string;
  classId: string;
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
  createdBy: string;
  createdAt: string;
};

export type JsonImage = {
  id: string;
  filePath: string;
  imageData: string | null;
  width: number;
  height: number;
  checksumSha256: string;
  source: string;
  capturedAt: string;
  split: string;
  annotations: JsonAnnotation[];
};

export type JsonClass = {
  id: string;
  name: string;
  classIndex: number;
  colorHex: string;
  source: string;
  cocoAlias: string | null;
};

export type JsonDataset = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  classes: JsonClass[];
  images: JsonImage[];
};

export type JsonModelVersion = {
  id: string;
  modelId: string;
  version: number;
  filePath: string;
  checksumSha256: string;
  state: string;
  classes: string[];
  metrics: Record<string, unknown>;
  trainingRunId: string | null;
  errorDetail: string | null;
  createdAt: string;
  activatedAt: string | null;
};

export type JsonModel = {
  id: string;
  name: string;
  taskType: string;
  description: string | null;
  createdAt: string;
  versions: JsonModelVersion[];
};

export type JsonDevice = {
  id: string;
  name: string;
  firstPairedAt: string;
  lastSeenAt: string;
  pairingTokenHash: string;
  sessionToken: string | null;
  status: string;
  ipAddress: string | null;
};

export type JsonStore = {
  detections: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  settings: Record<string, string | number>;
  datasets: JsonDataset[];
  models: JsonModel[];
  devices: JsonDevice[];
  trainingRuns: Array<Record<string, unknown>>;
  unknownSamples: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
};

export const DEFAULT_JSON_CLASSES = [
  { index: 0, name: "book", source: "pretrained", color: "#3B82F6", cocoAlias: null },
  { index: 1, name: "notebook", source: "custom", color: "#10B981", cocoAlias: null },
  { index: 2, name: "chair", source: "pretrained", color: "#F59E0B", cocoAlias: null },
  { index: 3, name: "table", source: "custom", color: "#EC4899", cocoAlias: "dining table" },
  { index: 4, name: "air_conditioner", source: "custom", color: "#8B5CF6", cocoAlias: null },
  { index: 5, name: "laptop", source: "pretrained", color: "#06B6D4", cocoAlias: null },
  { index: 6, name: "mobile_phone", source: "pretrained", color: "#EF4444", cocoAlias: "cell phone" },
  { index: 7, name: "bottle", source: "pretrained", color: "#14B8A6", cocoAlias: null },
  { index: 8, name: "backpack", source: "custom", color: "#F97316", cocoAlias: null },
  { index: 9, name: "keyboard", source: "custom", color: "#6366F1", cocoAlias: null },
  { index: 10, name: "mouse", source: "custom", color: "#84CC16", cocoAlias: null },
  { index: 11, name: "person", source: "pretrained", color: "#E11D48", cocoAlias: null },
];

const storePath = path.join(process.cwd(), "storage", "data.json");
let cache: JsonStore | null = null;
let writeQueue = Promise.resolve();

function emptyStore(): JsonStore {
  return {
    detections: [],
    users: [],
    settings: { model_version: "room_objects:v2", confidence_threshold: 0.5 },
    datasets: [],
    models: [],
    devices: [],
    trainingRuns: [],
    unknownSamples: [],
    auditLogs: [],
  };
}

function normalizeStore(value: Partial<JsonStore>): JsonStore {
  const base = emptyStore();
  return {
    ...base,
    ...value,
    datasets: value.datasets || [],
    models: value.models || [],
    devices: value.devices || [],
    trainingRuns: value.trainingRuns || [],
    unknownSamples: value.unknownSamples || [],
    auditLogs: value.auditLogs || [],
  };
}

export async function getJsonStore(): Promise<JsonStore> {
  if (cache) return cache;
  try {
    cache = normalizeStore(JSON.parse(await readFile(storePath, "utf8")));
  } catch {
    cache = emptyStore();
  }
  return cache;
}

export async function saveJsonStore(): Promise<void> {
  const snapshot = cache || emptyStore();
  cache = snapshot;
  writeQueue = writeQueue.then(async () => {
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(storePath, JSON.stringify(snapshot, null, 2), "utf8");
  });
  await writeQueue;
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function checksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function updateJsonStore<T>(mutate: (store: JsonStore) => T | Promise<T>): Promise<T> {
  const store = await getJsonStore();
  const result = await mutate(store);
  await saveJsonStore();
  return result;
}

export function datasetStats(dataset: JsonDataset) {
  const annotated = dataset.images.filter((image) => image.annotations.length > 0).length;
  return {
    imageCount: dataset.images.length,
    annotatedImageCount: annotated,
    annotationCount: dataset.images.reduce((sum, image) => sum + image.annotations.length, 0),
    classCount: dataset.classes.length,
    trainCount: dataset.images.filter((image) => image.split === "train").length,
    valCount: dataset.images.filter((image) => image.split === "val").length,
    testCount: dataset.images.filter((image) => image.split === "test").length,
  };
}
