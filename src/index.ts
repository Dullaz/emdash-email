/**
 * @dullaz/email — EmDash email transport plugin
 *
 * A dedicated email **transport** plugin for EmDash. It registers the exclusive
 * `email:deliver` hook and dispatches to a configured provider (Cloudflare first;
 * the provider abstraction in `src/providers/` makes adding Resend/SMTP/etc.
 * straightforward). Any plugin or EmDash core sends mail via `ctx.email.send()`;
 * activate this provider under the admin's Settings → Email.
 */
import { definePlugin } from "emdash";
import type { PluginDescriptor } from "emdash";
import { deliver } from "./email";
import { buildRoutes } from "./routes";

export const PLUGIN_ID = "dullaz-email";
export const PLUGIN_VERSION = "0.1.0";
const ENTRYPOINT = "@dullaz/email";
const ADMIN_ENTRY = "@dullaz/email/admin";

// biome-ignore lint/suspicious/noEmptyInterface: reserved for future options
export interface EmailPluginOptions {}

export function emailPlugin(
	options: EmailPluginOptions = {},
): PluginDescriptor<EmailPluginOptions> {
	return {
		id: PLUGIN_ID,
		version: PLUGIN_VERSION,
		entrypoint: ENTRYPOINT,
		adminEntry: ADMIN_ENTRY,
		format: "native",
		adminPages: [{ path: "/settings", label: "Email", icon: "mail" }],
		options,
	};
}

export function createPlugin(_options: EmailPluginOptions = {}) {
	return definePlugin({
		id: PLUGIN_ID,
		version: PLUGIN_VERSION,
		// network:request (Cloudflare API) + the transport-registration hook.
		capabilities: ["network:request", "hooks.email-transport:register"],
		allowedHosts: ["api.cloudflare.com"],
		hooks: {
			"email:deliver": { exclusive: true, handler: deliver },
		},
		routes: buildRoutes(),
		admin: {
			entry: ADMIN_ENTRY,
			pages: [{ path: "/settings", label: "Email", icon: "mail" }],
		},
	});
}

export default createPlugin;
