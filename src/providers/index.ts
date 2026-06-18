/** Provider registry. Add new providers here to make them selectable. */
import { cloudflareProvider } from "./cloudflare";
import type { EmailProvider } from "./provider";

export const PROVIDERS: EmailProvider[] = [cloudflareProvider];
export const DEFAULT_PROVIDER_ID = "cloudflare";

export function getProvider(id: string | undefined | null): EmailProvider | undefined {
	return PROVIDERS.find((p) => p.id === id);
}

export * from "./provider";
