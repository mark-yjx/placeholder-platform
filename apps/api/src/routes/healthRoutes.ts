import { ApiRequestContext } from '../observability/requestContext';
import { createApiLogger } from '../observability/structuredLogger';

export type HealthDependencyCheck = {
  name: string;
  check: () => Promise<boolean>;
};

export function createHealthRoutes(dependencies: readonly HealthDependencyCheck[]) {
  return {
    async liveness(context: ApiRequestContext): Promise<{ status: 'ok'; requestId: string }> {
      createApiLogger(context).info('api.liveness');
      return { status: 'ok', requestId: context.requestId };
    },
    async readiness(context: ApiRequestContext): Promise<{
      status: 'ready' | 'not_ready';
      requestId: string;
      dependencies: readonly { name: string; status: 'up' | 'down' }[];
    }> {
      const checks: { name: string; status: 'up' | 'down' }[] = [];
      for (const dependency of dependencies) {
        const isUp = await dependency.check();
        checks.push({ name: dependency.name, status: isUp ? 'up' : 'down' });
      }

      const isReady = checks.every((dependency) => dependency.status === 'up');
      createApiLogger(context).info('api.readiness', {
        status: isReady ? 'ready' : 'not_ready',
        dependencies: checks
      });

      return {
        status: isReady ? 'ready' : 'not_ready',
        requestId: context.requestId,
        dependencies: checks
      };
    }
  };
}
