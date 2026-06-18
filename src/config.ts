/** Provider configuration, stored in the plugin's own KV. */
import type { PluginContext } from "emdash";
import { DEFAULT_PROVIDER_ID } from "./providers";

const KV_KEY = "config";

export interface EmailConfig {
	/** Which provider id is active. */
	activeProvider: string;
	/** Per-provider config values, keyed by provider id. */
	providers: Record<string, Record<string, string>>;
}

export async function loadConfig(ctx: PluginContext): Promise<EmailConfig> {
	const stored = await ctx.kv.get<EmailConfig>(KV_KEY);
	return {
		activeProvider: stored?.activeProvider ?? DEFAULT_PROVIDER_ID,
		providers: stored?.providers ?? {},
	};
}

export async function saveConfig(ctx: PluginContext, config: EmailConfig): Promise<void> {
	await ctx.kv.set(KV_KEY, config);
}
