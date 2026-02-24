import { ApiRequestContext } from './requestContext';

export type ApiLogLevel = 'info' | 'error';

export type ApiLogEntry = {
  service: 'api';
  level: ApiLogLevel;
  message: string;
  requestId: string;
  timestamp: string;
  fields?: Readonly<Record<string, unknown>>;
};

export type ApiLogWriter = (entry: ApiLogEntry) => void;

export function createApiLogger(context: ApiRequestContext, write: ApiLogWriter = console.log): {
  info: (message: string, fields?: Readonly<Record<string, unknown>>) => void;
  error: (message: string, fields?: Readonly<Record<string, unknown>>) => void;
} {
  const emit = (level: ApiLogLevel, message: string, fields?: Readonly<Record<string, unknown>>) => {
    write({
      service: 'api',
      level,
      message,
      requestId: context.requestId,
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
