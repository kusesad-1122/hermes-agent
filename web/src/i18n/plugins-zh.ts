// Chinese descriptions for bundled plugins, shown on the 插件管理 (Plugins) page.
// Keyed by plugin name (matches the backend plugin.yaml `name`, i.e. row.name).
// Display-only overlay: when the UI locale is Chinese, PluginsPage shows this
// instead of the English plugin.yaml description; any plugin not listed here
// falls back to its English description.
//
// NOTE: populated with the full translated set once generation completes.

export interface PluginZh {
  description: string;
}

export const PLUGINS_ZH: Record<string, PluginZh> = {};
