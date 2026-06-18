import { describe, expect, test } from "bun:test";
import type { PluginContext } from "emdash";
import { deliver } from "./email";
import { cloudflareProvider } from "./providers/cloudflare";

function fakeCtx(opts: {
	config?: unknown;
	fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
}): { ctx: PluginContext; calls: Array<{ url: string; init: RequestInit }> } {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const ctx = {
		kv: { get: async () => opts.config ?? null },
		http: {
			fetch: async (url: string, init: RequestInit) => {
				calls.push({ url, init });
				return opts.fetchImpl
					? opts.fetchImpl(url, init)
					: new Response(JSON.stringify({ success: true }), { status: 200 });
			},
		},
		log: { info() {}, warn() {}, error() {}, debug() {} },
	} as unknown as PluginContext;
	return { ctx, calls };
}

const fullConfig = {
	activeProvider: "cloudflare",
	providers: {
		cloudflare: {
			accountId: "acc_123",
			apiToken: "tok_secret",
			fromEmail: "orders@shop.test",
			fromName: "Shop",
		},
	},
};

describe("cloudflare provider", () => {
	test("validate flags missing fields and accepts complete config", () => {
		expect(cloudflareProvider.validate({})).toBeTruthy();
		expect(
			cloudflareProvider.validate({ accountId: "a", apiToken: "t", fromEmail: "e@x.com" }),
		).toBeNull();
	});

	test("send posts to the Cloudflare endpoint with auth + from object", async () => {
		const { ctx, calls } = fakeCtx({});
		await cloudflareProvider.send({
			ctx,
			config: fullConfig.providers.cloudflare,
			message: { to: "buyer@test.com", subject: "Hi", text: "hello" },
		});
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(
			"https://api.cloudflare.com/client/v4/accounts/acc_123/email/sending/send",
		);
		const headers = calls[0].init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer tok_secret");
		const body = JSON.parse(String(calls[0].init.body));
		expect(body.to).toBe("buyer@test.com");
		expect(body.from).toEqual({ address: "orders@shop.test", name: "Shop" });
	});

	test("send throws on a non-ok response with the API error message", async () => {
		const { ctx } = fakeCtx({
			fetchImpl: async () =>
				new Response(JSON.stringify({ success: false, errors: [{ message: "Domain not verified" }] }), {
					status: 400,
				}),
		});
		await expect(
			cloudflareProvider.send({
				ctx,
				config: fullConfig.providers.cloudflare,
				message: { to: "x@y.com", subject: "s", text: "t" },
			}),
		).rejects.toThrow("Domain not verified");
	});
});

describe("deliver dispatch", () => {
	test("routes to the active provider when configured", async () => {
		const { ctx, calls } = fakeCtx({ config: fullConfig });
		await deliver({ message: { to: "a@b.com", subject: "s", text: "t" }, source: "test" }, ctx);
		expect(calls).toHaveLength(1);
	});

	test("throws when the active provider is unconfigured", async () => {
		const { ctx } = fakeCtx({ config: { activeProvider: "cloudflare", providers: {} } });
		await expect(
			deliver({ message: { to: "a@b.com", subject: "s", text: "t" }, source: "x" }, ctx),
		).rejects.toThrow(/not configured/);
	});
});
