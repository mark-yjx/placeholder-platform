export type ResourceLimits = {
  cpuCores: number;
  memoryMb: number;
  timeMs: number;
};

export const DEFAULT_RESOURCE_LIMITS: Readonly<ResourceLimits> = {
  cpuCores: 1,
  memoryMb: 256,
  timeMs: 2000
};
