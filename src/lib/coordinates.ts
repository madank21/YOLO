/**
 * Coordinate System & Transform Pipeline (Specification §11)
 *
 * (A) CAMERA/CAPTURE SPACE      — raw frame: width_cap × height_cap px
 * (B) UPRIGHT FRAME SPACE       — orientation-corrected: width_up × height_up px
 * (C) MODEL INPUT SPACE         — IMAGE_SIZE × IMAGE_SIZE px (default 640×640) with letterbox padding
 * (B) UPRIGHT FRAME SPACE       — inverse letterbox (subtract pad, divide by scale)
 * (D) NORMALIZED SPACE          — [0,1] × [0,1] resolution-independent coords
 * (E) DISPLAY/CANVAS SPACE      — actual on-screen rendered pixel coordinates
 */

export interface LetterboxResult {
  scale: number;
  padX: number;
  padY: number;
  targetSize: number;
}

export interface BoxCoords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface NormalizedBox {
  x1Norm: number;
  y1Norm: number;
  x2Norm: number;
  y2Norm: number;
}

export interface YoloCenterBox {
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
}

/**
 * Calculates letterbox transformation parameters (scale and offsets)
 * for embedding an image of width × height into a square targetSize × targetSize
 */
export function calculateLetterbox(
  srcWidth: number,
  srcHeight: number,
  targetSize: number = 640
): LetterboxResult {
  const scale = Math.min(targetSize / srcWidth, targetSize / srcHeight);
  const newWidth = Math.round(srcWidth * scale);
  const newHeight = Math.round(srcHeight * scale);
  const padX = (targetSize - newWidth) / 2;
  const padY = (targetSize - newHeight) / 2;

  return {
    scale,
    padX,
    padY,
    targetSize,
  };
}

/**
 * Transforms bounding boxes from Model Input Space (C) back to Upright Frame Space (B)
 */
export function unletterboxBoxes(
  box: BoxCoords,
  letterbox: LetterboxResult,
  originalWidth: number,
  originalHeight: number
): BoxCoords {
  const { scale, padX, padY } = letterbox;

  // Subtract letterbox padding, divide by scale
  const x1 = Math.max(0, Math.min(originalWidth, (box.x1 - padX) / scale));
  const y1 = Math.max(0, Math.min(originalHeight, (box.y1 - padY) / scale));
  const x2 = Math.max(0, Math.min(originalWidth, (box.x2 - padX) / scale));
  const y2 = Math.max(0, Math.min(originalHeight, (box.y2 - padY) / scale));

  return {
    x1: Math.round(x1 * 10) / 10,
    y1: Math.round(y1 * 10) / 10,
    x2: Math.round(x2 * 10) / 10,
    y2: Math.round(y2 * 10) / 10,
  };
}

/**
 * Converts Upright Frame Space pixels (B) to Normalized [0, 1] Space (D)
 */
export function toNormalizedCoords(
  box: BoxCoords,
  frameWidth: number,
  frameHeight: number
): NormalizedBox {
  return {
    x1Norm: Math.max(0, Math.min(1, box.x1 / frameWidth)),
    y1Norm: Math.max(0, Math.min(1, box.y1 / frameHeight)),
    x2Norm: Math.max(0, Math.min(1, box.x2 / frameWidth)),
    y2Norm: Math.max(0, Math.min(1, box.y2 / frameHeight)),
  };
}

/**
 * Converts Normalized [0, 1] Space (D) to YOLO format (xCenter, yCenter, width, height in [0,1])
 */
export function normalizedToYolo(box: NormalizedBox): YoloCenterBox {
  const width = Math.max(0, box.x2Norm - box.x1Norm);
  const height = Math.max(0, box.y2Norm - box.y1Norm);
  const xCenter = box.x1Norm + width / 2;
  const yCenter = box.y1Norm + height / 2;

  return {
    xCenter: Number(xCenter.toFixed(6)),
    yCenter: Number(yCenter.toFixed(6)),
    width: Number(width.toFixed(6)),
    height: Number(height.toFixed(6)),
  };
}

/**
 * Converts YOLO format (xCenter, yCenter, width, height) to Normalized [0, 1] Space
 */
export function yoloToNormalized(yolo: YoloCenterBox): NormalizedBox {
  const halfW = yolo.width / 2;
  const halfH = yolo.height / 2;

  return {
    x1Norm: Math.max(0, Math.min(1, yolo.xCenter - halfW)),
    y1Norm: Math.max(0, Math.min(1, yolo.yCenter - halfH)),
    x2Norm: Math.max(0, Math.min(1, yolo.xCenter + halfW)),
    y2Norm: Math.max(0, Math.min(1, yolo.yCenter + halfH)),
  };
}

/**
 * Maps Normalized Space (D) to Display/Canvas Space (E) given element bounding client rect
 */
export function normalizedToDisplay(
  box: NormalizedBox,
  displayWidth: number,
  displayHeight: number
): BoxCoords {
  return {
    x1: box.x1Norm * displayWidth,
    y1: box.y1Norm * displayHeight,
    x2: box.x2Norm * displayWidth,
    y2: box.y2Norm * displayHeight,
  };
}

/**
 * Calculate Intersection over Union (IoU) between two bounding boxes
 */
export function calculateIoU(a: BoxCoords, b: BoxCoords): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);

  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);

  const unionArea = areaA + areaB - intersectionArea;
  if (unionArea <= 0) return 0;

  return intersectionArea / unionArea;
}
