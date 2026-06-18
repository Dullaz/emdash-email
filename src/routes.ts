/**
 * Admin-only routes for the email plugin: read/save provider config and send a
 * test email. Uses an in-band error result (`{ __error }`) instead of throwing
 * emdash's PluginRouteError, which Vite can duplicate across the plugin/runner
 * boundary in dev (breaking `instanceof`). The admin client detects `__error`.
 */
import { z } from "astro/zod";
import type { PluginContext, PluginRoute, RouteContext } from "emdash";
import { loadConfig, saveConfig, type EmailConfig } from "./config";
import { getProvider, PROVIDERS } from "./providers";

class EmailRouteError extends Error {}
const fail = (message: string) => new EmailRouteError(message);

function wrap(routes: Record<string, PluginRoute>): Record<string, PluginRoute> {
	const out: Record<string, PluginRoute> = {};
	for (const [name, route] of Object.entries(routes)) {
		out[name] = {
			...route,
			handler: async (ctx: RouteContext) => {
				try {
					return await route.handler(ctx);
				} catch (err) {
					if (err instanceof EmailRouteError) return { __error: { message: err.message } };
					throw err;
				}
			},
		};
	}
	return out;
}

const SECRET_FIELDS = new Set(
	PROVIDERS.flatMap((p) => p.fields.filter((f) => f.type === "secret").map((f) => `${p.id}.${f.key}`)),
);
const isSecret = (providerId: string, key: string) => SECRET_FIELDS.has(`${providerId}.${key}`);

const saveInput = z.object({
	activeProvider: z.string().min(1),
	values: z.record(z.string(), z.record(z.string(), z.string())),
});
const testInput = z.object({ to: z.string().email() });

export function buildRoutes(): Record<string, PluginRoute> {
	return wrap({
		config: {
			handler: async (ctx: RouteContext) => {
				const cfg = await loadConfig(ctx);
				// Mask secret values: report whether set, never echo them back.
				const values: Record<string, Record<string, string>> = {};
				const secretsSet: Record<string, Record<string, boolean>> = {};
				for (const provider of PROVIDERS) {
					const stored = cfg.providers[provider.id] ?? {};
					values[provider.id] = {};
					secretsSet[provider.id] = {};
					for (const field of provider.fields) {
						if (field.type === "secret") {
							secretsSet[provider.id][field.key] = !!stored[field.key];
							values[provider.id][field.key] = "";
						} else {
							values[provider.id][field.key] = stored[field.key] ?? "";
						}
					}
				}
				return {
					activeProvider: cfg.activeProvider,
					providers: PROVIDERS.map((p) => ({ id: p.id, label: p.label, fields: p.fields })),
					values,
					secretsSet,
				};
			},
		},

		"config/save": {
			input: saveInput,
			handler: async (ctx: RouteContext) => {
				const input = ctx.input as z.infer<typeof saveInput>;
				if (!getProvider(input.activeProvider)) {
					throw fail(`Unknown provider "${input.activeProvider}"`);
				}
				const current = await loadConfig(ctx);
				const next: EmailConfig = {
					activeProvider: input.activeProvider,
					providers: { ...current.providers },
				};
				for (const provider of PROVIDERS) {
					const incoming = input.values[provider.id] ?? {};
					const merged: Record<string, string> = { ...(current.providers[provider.id] ?? {}) };
					for (const field of provider.fields) {
						const value = incoming[field.key];
						if (value === undefined) continue;
						// Blank secret = keep the existing value (the form never echoes it).
						if (isSecret(provider.id, field.key) && value === "") continue;
						merged[field.key] = value;
					}
					next.providers[provider.id] = merged;
				}
				await saveConfig(ctx, next);
				ctx.log.info("Email config saved", { activeProvider: next.activeProvider });
				return { ok: true };
			},
		},

		test: {
			input: testInput,
			handler: async (ctx: RouteContext) => {
				const { to } = ctx.input as z.infer<typeof testInput>;
				const cfg = await loadConfig(ctx);
				const provider = getProvider(cfg.activeProvider);
				if (!provider) throw fail(`Provider "${cfg.activeProvider}" is not available`);
				const config = cfg.providers[provider.id] ?? {};
				const problem = provider.validate(config);
				if (problem) throw fail(problem);
				try {
					await provider.send({
						ctx,
						config,
						message: {
							to,
							subject: "Test email from Buy Some Pixels",
							text: "This is a test email. If you received it, your provider is configured correctly.",
							html: "<p>This is a test email. If you received it, your provider is configured correctly.</p>",
						},
					});
				} catch (err) {
					throw fail(err instanceof Error ? err.message : "Send failed");
				}
				return { ok: true };
			},
		},
	});
}
