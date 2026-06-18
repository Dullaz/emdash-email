/**
 * Cloudflare Email Sending provider — sends via the REST API
 * (`/accounts/{id}/email/sending/send`) using `ctx.http.fetch`. The plugin
 * context can't reach the `send_email` Worker binding, so REST is the path.
 */
import { EmailNotConfiguredError, type EmailProvider } from "./provider";

export const cloudflareProvider: EmailProvider = {
	id: "cloudflare",
	label: "Cloudflare Email Sending",
	fields: [
		{ key: "accountId", label: "Account ID", type: "string" },
		{ key: "apiToken", label: "API token (Email Sending)", type: "secret" },
		{
			key: "fromEmail",
			label: "From email",
			type: "email",
			placeholder: "orders@yourdomain.com",
			help: "Must be on a domain onboarded to Cloudflare Email Sending.",
		},
		{ key: "fromName", label: "From name", type: "string", placeholder: "Buy Some Pixels" },
	],

	validate(config) {
		if (!config.accountId || !config.apiToken || !config.fromEmail) {
			return "Set the account ID, API token and from email.";
		}
		return null;
	},

	async send({ message, config, ctx }) {
		if (!ctx.http) throw new EmailNotConfiguredError("No network access available");
		const res = await ctx.http.fetch(
			`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${config.apiToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					to: message.to,
					from: config.fromName
						? { address: config.fromEmail, name: config.fromName }
						: config.fromEmail,
					subject: message.subject,
					text: message.text,
					...(message.html ? { html: message.html } : {}),
				}),
			},
		);
		if (!res.ok) {
			let detail = `HTTP ${res.status}`;
			try {
				const body = (await res.json()) as { errors?: Array<{ message?: string }> };
				if (body?.errors?.length) {
					detail = body.errors.map((e) => e.message).filter(Boolean).join("; ");
				}
			} catch {
				// non-JSON error body — keep the status code
			}
			throw new Error(`Cloudflare email send failed: ${detail}`);
		}
	},
};
