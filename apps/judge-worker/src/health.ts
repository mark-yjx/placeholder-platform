export type WorkerDependencyCheck = {
  name: string;
  check: () => Promise<boolean>;
};

export async function getWorkerLiveness(): Promise<{ status: 'ok' }> {
  return { status: 'ok' };
}

export async function getWorkerReadiness(
  dependencies: readonly WorkerDependencyCheck[]
): Promise<{ status: 'ready' | 'not_ready'; dependencies: readonly { name: string; status: 'up' | 'down' }[] }> {
  const checks: { name: string; status: 'up' | 'down' }[] = [];

  for (const dependency of dependencies) {
    const isUp = await dependency.check();
    checks.push({ name: dependency.name, status: isUp ? 'up' : 'down' });
  }

  const ready = checks.every((dependency) => dependency.status === 'up');
  return {
    status: ready ? 'ready' : 'not_ready',
    dependencies: checks
  };
}
