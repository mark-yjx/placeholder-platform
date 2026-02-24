export type WorkerRuntimeOptions = {
  pollIntervalMs?: number;
  onTick?: () => Promise<void> | void;
  logger?: {
    info: (message: string) => void;
    error: (message: string) => void;
  };
};

export type WorkerRuntimeHandle = {
  stop: () => Promise<void>;
};

export function startWorkerRuntime(options?: WorkerRuntimeOptions): WorkerRuntimeHandle {
  const pollIntervalMs = options?.pollIntervalMs ?? 1000;
  const onTick = options?.onTick ?? (async () => undefined);
  const logger = options?.logger ?? console;

  let stopping = false;
  let runningTick = Promise.resolve();

  logger.info('worker.runtime.started');

  const interval = setInterval(() => {
    if (stopping) {
      return;
    }

    runningTick = Promise.resolve(onTick()).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`worker.runtime.tick_error: ${message}`);
    });
  }, pollIntervalMs);

  return {
    stop: async () => {
      if (stopping) {
        return;
      }
      stopping = true;
      clearInterval(interval);
      await runningTick;
      logger.info('worker.runtime.stopped');
    }
  };
}

export function runWorkerProcess(): void {
  const runtime = startWorkerRuntime();

  const shutdown = async () => {
    await runtime.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });
}
