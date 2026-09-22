import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Datasets
export const datasets = pgTable("datasets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  parentDatasetId: uuid("parent_dataset_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const datasetsRelations = relations(datasets, ({ many, one }) => ({
  parent: one(datasets, {
    fields: [datasets.parentDatasetId],
    references: [datasets.id],
    relationName: "parentDataset",
  }),
  classes: many(datasetClasses),
  images: many(images),
  trainingRuns: many(trainingRuns),
}));

// Dataset Classes
export const datasetClasses = pgTable("dataset_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  datasetId: uuid("dataset_id")
    .notNull()
    .references(() => datasets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  classIndex: integer("class_index").notNull(),
  colorHex: text("color_hex").notNull().default("#3B82F6"),
  source: text("source").notNull().default("custom"), // 'pretrained' | 'custom'
  cocoAlias: text("coco_alias"),
});

export const datasetClassesRelations = relations(datasetClasses, ({ one, many }) => ({
  dataset: one(datasets, {
    fields: [datasetClasses.datasetId],
    references: [datasets.id],
  }),
  annotations: many(annotations),
}));

// Images
export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  datasetId: uuid("dataset_id")
    .notNull()
    .references(() => datasets.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  imageData: text("image_data"), // base64 or URL
  width: integer("width").notNull().default(1280),
  height: integer("height").notNull().default(720),
  checksumSha256: text("checksum_sha256").notNull(),
  source: text("source").notNull().default("upload"), // 'capture' | 'upload' | 'unknown_sample'
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  split: text("split").notNull().default("unassigned"), // 'train' | 'val' | 'test' | 'unassigned'
});

export const imagesRelations = relations(images, ({ one, many }) => ({
  dataset: one(datasets, {
    fields: [images.datasetId],
    references: [datasets.id],
  }),
  annotations: many(annotations),
}));

// Annotations
export const annotations = pgTable("annotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageId: uuid("image_id")
    .notNull()
    .references(() => images.id, { onDelete: "cascade" }),
  classId: uuid("class_id")
    .notNull()
    .references(() => datasetClasses.id, { onDelete: "cascade" }),
  xCenter: doublePrecision("x_center").notNull(),
  yCenter: doublePrecision("y_center").notNull(),
  width: doublePrecision("width").notNull(),
  height: doublePrecision("height").notNull(),
  createdBy: text("created_by").notNull().default("human"), // 'human' | 'import'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const annotationsRelations = relations(annotations, ({ one }) => ({
  image: one(images, {
    fields: [annotations.imageId],
    references: [images.id],
  }),
  class: one(datasetClasses, {
    fields: [annotations.classId],
    references: [datasetClasses.id],
  }),
}));

// Models
export const models = pgTable("models", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(), // e.g. "room_objects"
  taskType: text("task_type").notNull().default("detection"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const modelsRelations = relations(models, ({ many }) => ({
  versions: many(modelVersions),
}));

// Model Versions
export const modelVersions = pgTable("model_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => models.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  filePath: text("file_path").notNull(),
  checksumSha256: text("checksum_sha256").notNull(),
  state: text("state").notNull().default("IMPORTED"), // 'IMPORTED' | 'VALIDATING' | 'READY' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED' | 'FAILED'
  classes: jsonb("classes").notNull().default([]),
  metrics: jsonb("metrics").notNull().default({}),
  trainingRunId: uuid("training_run_id"),
  errorDetail: text("error_detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
});

export const modelVersionsRelations = relations(modelVersions, ({ one }) => ({
  model: one(models, {
    fields: [modelVersions.modelId],
    references: [models.id],
  }),
  trainingRun: one(trainingRuns, {
    fields: [modelVersions.trainingRunId],
    references: [trainingRuns.id],
  }),
}));

// Training Runs
export const trainingRuns = pgTable("training_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  datasetId: uuid("dataset_id").references(() => datasets.id, { onDelete: "set null" }),
  datasetVersion: integer("dataset_version").notNull().default(1),
  baseCheckpoint: text("base_checkpoint").notNull().default("yolo11n.pt"),
  hyperparameters: jsonb("hyperparameters").notNull().default({}),
  environment: jsonb("environment").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status").notNull().default("imported"), // 'imported' | 'validated' | 'failed_validation'
  resultBundlePath: text("result_bundle_path"),
  notes: text("notes"),
});

export const trainingRunsRelations = relations(trainingRuns, ({ one }) => ({
  dataset: one(datasets, {
    fields: [trainingRuns.datasetId],
    references: [datasets.id],
  }),
}));

// Devices
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  firstPairedAt: timestamp("first_paired_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  pairingTokenHash: text("pairing_token_hash").notNull(),
  sessionToken: text("session_token"),
  status: text("status").notNull().default("paired"), // 'paired' | 'active' | 'disconnected' | 'revoked'
  ipAddress: text("ip_address"),
});

// Detection Sessions
export const detectionSessions = pgTable("detection_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
  modelVersionId: uuid("model_version_id").references(() => modelVersions.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  frameCount: integer("frame_count").notNull().default(0),
  avgFps: doublePrecision("avg_fps").notNull().default(0),
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'disconnected'
});

// Detection Events
export const detectionEvents = pgTable("detection_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => detectionSessions.id, { onDelete: "cascade" }),
  frameId: integer("frame_id").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  className: text("class_name").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  x1: doublePrecision("x1").notNull(),
  y1: doublePrecision("y1").notNull(),
  x2: doublePrecision("x2").notNull(),
  y2: doublePrecision("y2").notNull(),
  trackId: integer("track_id"),
  isUnknown: boolean("is_unknown").notNull().default(false),
});

// System Configuration
export const systemConfiguration = pgTable("system_configuration", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Unknown Samples (Holding Area)
export const unknownSamples = pgTable("unknown_samples", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageData: text("image_data").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  detectedClass: text("detected_class"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status").notNull().default("captured"), // 'captured' | 'assigned' | 'discarded'
  targetDatasetId: uuid("target_dataset_id").references(() => datasets.id, { onDelete: "set null" }),
  assignedLabel: text("assigned_label"),
});

// Audit / System Logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  level: text("level").notNull().default("INFO"),
  event: text("event").notNull(),
  code: text("code"),
  details: jsonb("details").default({}),
});
