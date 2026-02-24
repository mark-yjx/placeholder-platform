import { RunnerPlugin } from './RunnerPlugin';

export class RunnerRegistry {
  private readonly pluginsByLanguage = new Map<string, RunnerPlugin>();

  constructor(plugins: readonly RunnerPlugin[]) {
    for (const plugin of plugins) {
      this.pluginsByLanguage.set(plugin.language.toLowerCase(), plugin);
    }
  }

  resolve(language: string): RunnerPlugin {
    const plugin = this.pluginsByLanguage.get(language.toLowerCase());
    if (!plugin) {
      throw new Error(`Unsupported language: ${language}`);
    }
    return plugin;
  }
}
