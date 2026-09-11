import { DEFAULT_JSON_CLASSES } from "@/lib/json-store";
import { successResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return successResponse({
    classes: DEFAULT_JSON_CLASSES.map((c) => ({
      index: c.index,
      name: c.name,
      source: c.source,
      coco_alias: c.cocoAlias,
      color: c.color,
      requires_custom_dataset: c.source === "custom",
    })),
  });
}
