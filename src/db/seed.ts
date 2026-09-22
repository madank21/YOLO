import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { db } from "@/db";
import { systemConfiguration, models, modelVersions } from "@/db/schema";

export const DEFAULT_CLASSES = [
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

export const DEFAULT_CONFIG: Record<string, string> = {
  APP_ENV: "development",
  HOST: "0.0.0.0",
  PORT: "3000",
  MODEL_PATH: "models/room_objects/v2/model.pt",
  BASE_MODEL_CHECKPOINT: "yolo11n.pt",
  CONFIDENCE_THRESHOLD: "0.40",
  IOU_THRESHOLD: "0.45",
  IMAGE_SIZE: "640",
  DEVICE: "auto",
  HALF_PRECISION: "auto",
  STREAM_TARGET_FPS: "30",
  STREAM_JPEG_QUALITY: "70",
  STREAM_MAX_FRAME_BYTES: "1048576",
  PAIRING_TOKEN_TTL_SECONDS: "300",
  SESSION_TOKEN_TTL_SECONDS: "86400",
  DETECTION_EVENT_RETENTION_DAYS: "30",
};

function getModelChecksum(): string {
  const modelPath = resolve(process.cwd(), "models/room_objects/v2/model.pt");
  return existsSync(modelPath)
    ? createHash("sha256").update(readFileSync(modelPath)).digest("hex")
    : "unverified";
}

export async function seedDatabase() {
  const existingConfig = await db.select().from(systemConfiguration).limit(1);
  if (existingConfig.length > 0) return { status: "already_initialized" };

  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    await db.insert(systemConfiguration).values({ key, value, updatedAt: new Date() });
  }

  const [model] = await db.insert(models).values({
    name: "room_objects",
    taskType: "detection",
    description: "Custom room and classroom object detection model.",
  }).returning();

  await db.insert(modelVersions).values({
    modelId: model.id,
    version: 2,
    filePath: "models/room_objects/v2/model.pt",
    checksumSha256: getModelChecksum(),
    state: "ACTIVE",
    classes: DEFAULT_CLASSES.map((item) => item.name),
    metrics: {},
    activatedAt: new Date(),
  });

  return { status: "initialized" };
}
