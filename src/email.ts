/** The exclusive `email:deliver` handler — dispatches to the active provider. */
import type { PluginContext } from "emdash";
import { loadConfig } from "./config";
import { getProvider } from "./providers";

export interface DeliverEvent {
	message: { to: string; subject: string; text: string; html?: string };
	source?: string;
}

export async function deliver(event: DeliverEvent, ctx: PluginContext): Promise<void> {
	const cfg = await loadConfig(ctx);
	const provider = getProvider(cfg.activeProvider);
	if (!provider) {
		throw new Error(`Email provider "${cfg.activeProvider}" is not available`);
	}
	const config = cfg.providers[provider.id] ?? {};
	const problem = provider.validate(config);
	if (problem) {
		throw new Error(`Email provider "${provider.id}" is not configured: ${problem}`);
	}
	await provider.send({ message: event.message, config, ctx });
	ctx.log.info("Email delivered", {
		to: event.message.to,
		provider: provider.id,
		source: event.source,
	});
}
