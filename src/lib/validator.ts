export interface ValidationErrorItem {
  code: string;
  count: number;
  message: string;
  examples: string[];
}

export interface ValidationWarningItem {
  code: string;
  class?: string;
  count?: number;
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  totalImages: number;
  totalAnnotations: number;
  errors: ValidationErrorItem[];
  warnings: ValidationWarningItem[];
  checkedAt: string;
  splitSummary: {
    train: number;
    val: number;
    test: number;
    unassigned: number;
  };
  classDistribution: Record<string, number>;
}

export interface DatasetValidationInput {
  datasetId: string;
  classes: Array<{ id: string; name: string; classIndex: number }>;
  images: Array<{
    id: string;
    filePath: string;
    width: number;
    height: number;
    checksumSha256: string;
    split: string;
    hasData: boolean;
  }>;
  annotations: Array<{
    id: string;
    imageId: string;
    classId: string;
    xCenter: number;
    yCenter: number;
    width: number;
    height: number;
  }>;
}

export function validateDataset(input: DatasetValidationInput): ValidationReport {
  const errors: ValidationErrorItem[] = [];
  const warnings: ValidationWarningItem[] = [];

  const classMap = new Map(input.classes.map((c) => [c.id, c.name]));
  const imageMap = new Map(input.images.map((img) => [img.id, img]));

  // Index annotations by image and class
  const annByImage = new Map<string, typeof input.annotations>();
  const classCounts: Record<string, number> = {};
  input.classes.forEach((c) => {
    classCounts[c.name] = 0;
  });

  input.annotations.forEach((ann) => {
    if (!annByImage.has(ann.imageId)) {
      annByImage.set(ann.imageId, []);
    }
    annByImage.get(ann.imageId)!.push(ann);

    const className = classMap.get(ann.classId);
    if (className) {
      classCounts[className] = (classCounts[className] || 0) + 1;
    }
  });

  // Check 1: Missing labels (images with 0 annotations)
  const imagesWithoutLabels: string[] = [];
  input.images.forEach((img) => {
    const anns = annByImage.get(img.id) || [];
    if (anns.length === 0) {
      imagesWithoutLabels.push(img.filePath);
    }
  });
  if (imagesWithoutLabels.length > 0) {
    errors.push({
      code: "MISSING_LABELS",
      count: imagesWithoutLabels.length,
      message: `${imagesWithoutLabels.length} image(s) have no annotations and are not marked as negative background samples.`,
      examples: imagesWithoutLabels.slice(0, 5),
    });
  }

  // Check 2: Missing images (annotations referencing nonexistent image)
  const orphanAnnotations: string[] = [];
  input.annotations.forEach((ann) => {
    if (!imageMap.has(ann.imageId)) {
      orphanAnnotations.push(ann.id);
    }
  });
  if (orphanAnnotations.length > 0) {
    errors.push({
      code: "MISSING_IMAGES",
      count: orphanAnnotations.length,
      message: `${orphanAnnotations.length} annotation(s) reference missing or deleted image records.`,
      examples: orphanAnnotations.slice(0, 5),
    });
  }

  // Check 3: Corrupt or empty image data
  const corruptImages: string[] = [];
  input.images.forEach((img) => {
    if (!img.hasData || img.width <= 0 || img.height <= 0) {
      corruptImages.push(img.filePath);
    }
  });
  if (corruptImages.length > 0) {
    errors.push({
      code: "CORRUPT_IMAGES",
      count: corruptImages.length,
      message: `${corruptImages.length} image(s) cannot be decoded or have invalid pixel dimensions.`,
      examples: corruptImages.slice(0, 5),
    });
  }

  // Check 4: Invalid class IDs
  const invalidClassAnns: string[] = [];
  input.annotations.forEach((ann) => {
    if (!classMap.has(ann.classId)) {
      invalidClassAnns.push(ann.id);
    }
  });
  if (invalidClassAnns.length > 0) {
    errors.push({
      code: "INVALID_CLASS_ID",
      count: invalidClassAnns.length,
      message: `${invalidClassAnns.length} annotation(s) reference a class ID not defined in the dataset's class registry.`,
      examples: invalidClassAnns.slice(0, 5),
    });
  }

  // Check 5: Malformed annotation (outside [0,1] or width/height <= 0)
  const malformedAnns: string[] = [];
  input.annotations.forEach((ann) => {
    const isOut =
      ann.xCenter < 0 ||
      ann.xCenter > 1 ||
      ann.yCenter < 0 ||
      ann.yCenter > 1 ||
      ann.width <= 0 ||
      ann.width > 1 ||
      ann.height <= 0 ||
      ann.height > 1 ||
      ann.xCenter - ann.width / 2 < 0 ||
      ann.xCenter + ann.width / 2 > 1 ||
      ann.yCenter - ann.height / 2 < 0 ||
      ann.yCenter + ann.height / 2 > 1;
    if (isOut) {
      malformedAnns.push(`Ann ${ann.id.slice(0, 8)}: [x=${ann.xCenter}, y=${ann.yCenter}, w=${ann.width}, h=${ann.height}]`);
    }
  });
  if (malformedAnns.length > 0) {
    errors.push({
      code: "MALFORMED_ANNOTATION",
      count: malformedAnns.length,
      message: `${malformedAnns.length} annotation(s) have coordinates outside [0,1] or non-positive dimensions.`,
      examples: malformedAnns.slice(0, 5),
    });
  }

  // Check 6: Zero-sized boxes (< 4 px² when rendered on original image)
  const zeroSizedBoxes: string[] = [];
  input.annotations.forEach((ann) => {
    const img = imageMap.get(ann.imageId);
    if (img) {
      const areaPx = ann.width * ann.height * img.width * img.height;
      if (areaPx < 4) {
        zeroSizedBoxes.push(`Ann ${ann.id.slice(0, 8)} (${areaPx.toFixed(1)} px²)`);
      }
    }
  });
  if (zeroSizedBoxes.length > 0) {
    errors.push({
      code: "ZERO_SIZED_BOXES",
      count: zeroSizedBoxes.length,
      message: `${zeroSizedBoxes.length} box(es) have an area less than 4 px² (degenerate point or sliver).`,
      examples: zeroSizedBoxes.slice(0, 5),
    });
  }

  // Check 7: Duplicate images (checksum SHA-256 collision)
  const checksumMap = new Map<string, string[]>();
  input.images.forEach((img) => {
    if (img.checksumSha256) {
      if (!checksumMap.has(img.checksumSha256)) {
        checksumMap.set(img.checksumSha256, []);
      }
      checksumMap.get(img.checksumSha256)!.push(img.filePath);
    }
  });
  const duplicates: string[] = [];
  checksumMap.forEach((paths) => {
    if (paths.length > 1) {
      duplicates.push(paths.join(" <=> "));
    }
  });
  if (duplicates.length > 0) {
    errors.push({
      code: "DUPLICATE_FILES",
      count: duplicates.length,
      message: `${duplicates.length} duplicate file set(s) found with identical SHA-256 checksums.`,
      examples: duplicates.slice(0, 5),
    });
  }

  // Check 8: Train/Val/Test Leakage (same checksum across different splits)
  const checksumSplits = new Map<string, Set<string>>();
  input.images.forEach((img) => {
    if (!checksumSplits.has(img.checksumSha256)) {
      checksumSplits.set(img.checksumSha256, new Set());
    }
    checksumSplits.get(img.checksumSha256)!.add(img.split);
  });
  const leakageExamples: string[] = [];
  checksumSplits.forEach((splits, hash) => {
    if (splits.size > 1) {
      leakageExamples.push(`${hash.slice(0, 10)} appears in splits: [${Array.from(splits).join(", ")}]`);
    }
  });
  if (leakageExamples.length > 0) {
    errors.push({
      code: "TRAIN_VAL_TEST_LEAKAGE",
      count: leakageExamples.length,
      message: `${leakageExamples.length} image(s) leak between train, val, or test splits.`,
      examples: leakageExamples.slice(0, 5),
    });
  }

  // Check 9: Class Imbalance Warning (< 5 instances per class)
  for (const [clsName, count] of Object.entries(classCounts)) {
    if (count < 5) {
      warnings.push({
        code: "CLASS_IMBALANCE",
        class: clsName,
        count,
        message: `Class "${clsName}" has only ${count} annotated sample(s). Recommend at least 5-15 examples before training.`,
      });
    }
  }

  // Split summary
  const splitSummary = {
    train: 0,
    val: 0,
    test: 0,
    unassigned: 0,
  };
  input.images.forEach((img) => {
    const s = img.split as keyof typeof splitSummary;
    if (splitSummary[s] !== undefined) {
      splitSummary[s]++;
    } else {
      splitSummary.unassigned++;
    }
  });

  return {
    valid: errors.length === 0,
    totalImages: input.images.length,
    totalAnnotations: input.annotations.length,
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
    splitSummary,
    classDistribution: classCounts,
  };
}
