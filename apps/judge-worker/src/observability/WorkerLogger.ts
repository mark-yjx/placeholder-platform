export type WorkerLogEntry = {
  service: 'judge-worker';
  level: 'info' | 'error';
  message: string;
  jobId: string;
  timestamp: string;
  fields?: Readonly<Record<string, unknown>>;
};

export type WorkerLogWriter = (entry: WorkerLogEntry) => void;

export function createWorkerLogger(jobId: string, write: WorkerLogWriter = console.log): {
  info: (message: string, fields?: Readonly<Record<string, unknown>>) => void;
  error: (message: string, fields?: Readonly<Record<string, unknown>>) => void;
} {
  const emit = (
    level: 'info' | 'error',
    message: string,
    fields?: Readonly<Record<string, unknown>>
  ) => {
    write({
      service: 'judge-worker',
      level,
      message,
      jobId,
      timestamp: new Date().toISOString(),
      fields
    });
  };

  return {
    info(message, fields) {
      emit('info', message, fields);
    },
    error(message, fields) {
      emit('error', message, fields);
    }
  };
}
