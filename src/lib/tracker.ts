import { BoxCoords, calculateIoU } from "./coordinates";

export interface TrackedObject {
  trackId: number;
  className: string;
  box: BoxCoords;
  confidence: number;
  lastSeenFrame: number;
  age: number;
}

export interface DetectionInput {
  className: string;
  confidence: number;
  box: BoxCoords;
  isUnknown?: boolean;
}

export interface TrackedDetectionResult extends DetectionInput {
  trackId: number;
}

export class ObjectTracker {
  private tracks: Map<number, TrackedObject> = new Map();
  private nextTrackId: number = 1;
  private currentFrameId: number = 0;
  private iouThreshold: number;
  private trackTtlFrames: number;
  public sessionId: string;

  constructor(sessionId: string, iouThreshold = 0.3, trackTtlFrames = 10) {
    this.sessionId = sessionId;
    this.iouThreshold = iouThreshold;
    this.trackTtlFrames = trackTtlFrames;
  }

  /**
   * Updates tracks for the current frame using greedy IoU matching
   */
  public update(detections: DetectionInput[], frameId: number): TrackedDetectionResult[] {
    this.currentFrameId = frameId;
    const matchedTrackIds = new Set<number>();
    const results: TrackedDetectionResult[] = [];

    // Sort detections by confidence descending
    const sortedDets = [...detections].sort((a, b) => b.confidence - a.confidence);

    for (const det of sortedDets) {
      let bestIoU = 0;
      let bestTrackId: number | null = null;

      // Find best matching existing track with same class and IoU >= threshold
      for (const [trackId, track] of this.tracks.entries()) {
        if (matchedTrackIds.has(trackId)) continue;
        if (track.className !== det.className) continue;

        const iou = calculateIoU(det.box, track.box);
        if (iou >= this.iouThreshold && iou > bestIoU) {
          bestIoU = iou;
          bestTrackId = trackId;
        }
      }

      let assignedTrackId: number;

      if (bestTrackId !== null) {
        // Matched existing track
        assignedTrackId = bestTrackId;
        matchedTrackIds.add(assignedTrackId);

        const existing = this.tracks.get(assignedTrackId)!;
        this.tracks.set(assignedTrackId, {
          ...existing,
          box: det.box,
          confidence: det.confidence,
          lastSeenFrame: frameId,
          age: existing.age + 1,
        });
      } else {
        // Unmatched new detection: create fresh track ID
        assignedTrackId = this.nextTrackId++;
        matchedTrackIds.add(assignedTrackId);

        this.tracks.set(assignedTrackId, {
          trackId: assignedTrackId,
          className: det.className,
          box: det.box,
          confidence: det.confidence,
          lastSeenFrame: frameId,
          age: 1,
        });
      }

      results.push({
        ...det,
        trackId: assignedTrackId,
      });
    }

    // Drop stale tracks that haven't been matched for > trackTtlFrames
    for (const [trackId, track] of this.tracks.entries()) {
      if (frameId - track.lastSeenFrame > this.trackTtlFrames) {
        this.tracks.delete(trackId);
      }
    }

    return results;
  }

  /**
   * Clear all tracks (e.g. when session ends or resets)
   */
  public reset(): void {
    this.tracks.clear();
    this.nextTrackId = 1;
    this.currentFrameId = 0;
  }

  public getActiveTrackCount(): number {
    return this.tracks.size;
  }
}
