/**
 * Email provider abstraction. A provider knows how to send a message and what
 * configuration fields it needs (so the admin UI can render a form generically).
 * Add new providers (Resend, SMTP, SES…) by implementing this interface and
 * registering them in `./index.ts`.
 */
import type { PluginContext } from "emdash";

export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

/** A provider's configuration values (field key → value). */
export type ProviderConfig = Record<string, string>;

export type ProviderFieldType = "string" | "secret" | "email";

export interface ProviderField {
	key: string;
	label: string;
	type: ProviderFieldType;
	placeholder?: string;
	help?: string;
}

export interface SendArgs {
	message: EmailMessage;
	config: ProviderConfig;
	ctx: PluginContext;
}

export interface EmailProvider {
	id: string;
	label: string;
	/** Config fields the provider needs — drives the admin settings form. */
	fields: ProviderField[];
	/** Return a problem message if config is incomplete, else null. */
	validate(config: ProviderConfig): string | null;
	send(args: SendArgs): Promise<void>;
}

export class EmailNotConfiguredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EmailNotConfiguredError";
	}
}
