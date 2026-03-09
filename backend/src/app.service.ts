import { Injectable } from '@nestjs/common';

type MemorySnapshot = {
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
  externalMb: number;
  arrayBuffersMb: number;
  bufferLeakChunks: number;
  bufferLeakBytesMb: number;
  heapLeakObjects: number;
  heapLeakApproxMb: number;
};

@Injectable()
export class AppService {
  private readonly bufferLeakStore: Buffer[] = [];
  private readonly heapLeakStore: Array<Record<string, unknown>> = [];
  private bufferLeakInterval: NodeJS.Timeout | null = null;
  private heapLeakInterval: NodeJS.Timeout | null = null;

  getHello(): string {
    return 'Hello World!';
  }

  /** Returns main Node.js memory counters in MB. */
  getMemorySnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    const bufferLeakBytes = this.bufferLeakStore.reduce(
      (total, chunk) => total + chunk.length,
      0,
    );
    const heapLeakApproxBytes = this.heapLeakStore.length * 1024;

    return {
      rssMb: this.toMb(usage.rss),
      heapTotalMb: this.toMb(usage.heapTotal),
      heapUsedMb: this.toMb(usage.heapUsed),
      externalMb: this.toMb(usage.external),
      arrayBuffersMb: this.toMb(usage.arrayBuffers),
      bufferLeakChunks: this.bufferLeakStore.length,
      bufferLeakBytesMb: this.toMb(bufferLeakBytes),
      heapLeakObjects: this.heapLeakStore.length,
      heapLeakApproxMb: this.toMb(heapLeakApproxBytes),
    };
  }

  /**
   * Starts a controlled leak by retaining Buffer chunks in memory.
   * Buffers live outside V8 heap, so watch `rss` and `external` rise.
   */
  startBufferLeak(chunkKb = 256, intervalMs = 200): MemorySnapshot {
    this.stopBufferLeak();

    this.bufferLeakInterval = setInterval(() => {
      this.bufferLeakStore.push(Buffer.alloc(chunkKb * 1024, 0x61));
    }, intervalMs);

    return this.getMemorySnapshot();
  }

  /** Stops leak generation but keeps already leaked chunks. */
  stopBufferLeak(): MemorySnapshot {
    if (this.bufferLeakInterval) {
      clearInterval(this.bufferLeakInterval);
      this.bufferLeakInterval = null;
    }

    return this.getMemorySnapshot();
  }

  /** Drops retained chunks so GC can reclaim memory on next cycle. */
  clearBufferLeak(): MemorySnapshot {
    this.bufferLeakStore.length = 0;
    return this.getMemorySnapshot();
  }

  /** Adds one retained chunk immediately for quick smoke tests. */
  bufferLeakOnce(chunkKb = 512): MemorySnapshot {
    this.bufferLeakStore.push(Buffer.alloc(chunkKb * 1024, 0x62));
    return this.getMemorySnapshot();
  }

  /**
   * Starts a controlled V8 heap leak by retaining object graphs.
   * Expect `heapUsed` to climb over time.
   */
  startHeapLeak(objectsPerTick = 200, intervalMs = 200): MemorySnapshot {
    this.stopHeapLeak();

    this.heapLeakInterval = setInterval(() => {
      for (let i = 0; i < objectsPerTick; i += 1) {
        const payload = 'x'.repeat(768);
        this.heapLeakStore.push({
          id: `${Date.now()}-${i}`,
          payload,
          tags: ['import', 'memory', 'heap'],
          nested: { payloadCopy: payload, n: i },
        });
      }
    }, intervalMs);

    return this.getMemorySnapshot();
  }

  /** Stops heap leak generation but keeps retained objects. */
  stopHeapLeak(): MemorySnapshot {
    if (this.heapLeakInterval) {
      clearInterval(this.heapLeakInterval);
      this.heapLeakInterval = null;
    }

    return this.getMemorySnapshot();
  }

  /** Drops retained heap objects so GC can reclaim them on next cycle. */
  clearHeapLeak(): MemorySnapshot {
    this.heapLeakStore.length = 0;
    return this.getMemorySnapshot();
  }

  getLeakStatus() {
    return {
      bufferLeakRunning: Boolean(this.bufferLeakInterval),
      heapLeakRunning: Boolean(this.heapLeakInterval),
      ...this.getMemorySnapshot(),
    };
  }

  /**
   * Triggers GC when Node is started with --expose-gc.
   * Useful in labs to show post-clear memory more deterministically.
   */
  runGc(): { gcExposed: boolean; snapshot: MemorySnapshot } {
    const gcExposed = typeof global.gc === 'function';

    if (gcExposed) {
      global.gc?.();
    }

    return {
      gcExposed,
      snapshot: this.getMemorySnapshot(),
    };
  }

  private toMb(bytes: number): number {
    return Number((bytes / (1024 * 1024)).toFixed(2));
  }
}
