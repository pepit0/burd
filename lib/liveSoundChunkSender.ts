import { identifyAudioChunkSafe, type IdentifyResult } from "@/lib/identify";
import type { IdentifyGeoOptions } from "@/lib/identify";
import { stabilizeAudioForUpload } from "@/lib/audioUploadStabilize";
import { logSoundDebug } from "@/lib/soundDebug";

export interface LiveSoundChunkPayload {
  uploadUri: string;
  geo: IdentifyGeoOptions;
}

export type LiveSoundChunkResultHandler = (
  outcome:
    | { ok: true; result: IdentifyResult }
    | { ok: false; reason: string; dropped?: boolean },
) => void;

/**
 * Serialize uploads so slow Perch responses do not overlap. Remote CPU
 * inference (Fly) can take up to a minute; running one at a time avoids
 * thrashing the server. Only the most recent queued chunk is kept so live
 * results track current audio instead of falling minutes behind.
 */
export class LiveSoundChunkSender {
  private pending = 0;
  private readonly queue: LiveSoundChunkPayload[] = [];

  constructor(
    private readonly maxInFlight = 1,
    private readonly maxQueued = 1,
  ) {}

  get inFlight(): number {
    return this.pending;
  }

  get queued(): number {
    return this.queue.length;
  }

  submit(payload: LiveSoundChunkPayload, onResult: LiveSoundChunkResultHandler): void {
    if (this.pending >= this.maxInFlight) {
      this.queue.push(payload);
      // Drop the oldest queued chunks so the backlog never grows unbounded on
      // a slow server — keep only the freshest audio.
      while (this.queue.length > this.maxQueued) {
        this.queue.shift();
      }
      logSoundDebug("queue", `chunk queued (${this.queue.length} waiting)`, {
        uploadUri: payload.uploadUri,
      });
      return;
    }

    void this.run(payload, onResult);
  }

  async waitForIdle(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while ((this.pending > 0 || this.queue.length > 0) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async run(
    payload: LiveSoundChunkPayload,
    onResult: LiveSoundChunkResultHandler,
  ): Promise<void> {
    this.pending += 1;

    try {
      const uploadUri = await stabilizeAudioForUpload(payload.uploadUri);
      logSoundDebug("upload", "sending audio chunk", { uploadUri });
      const outcome = await identifyAudioChunkSafe(uploadUri, payload.geo);
      onResult(outcome);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Could not prepare audio upload.";
      onResult({ ok: false, reason });
    } finally {
      this.pending = Math.max(0, this.pending - 1);
      this.drain(onResult);
    }
  }

  private drain(onResult: LiveSoundChunkResultHandler): void {
    while (this.queue.length > 0 && this.pending < this.maxInFlight) {
      const next = this.queue.shift();
      if (!next) return;
      void this.run(next, onResult);
    }
  }
}
