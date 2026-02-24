export type RunnerResolution = {
  language: string;
  runArgs: readonly string[];
};

export interface RunnerPlugin {
  readonly language: string;
  resolve(): RunnerResolution;
}
