/** Admin page: choose the active email provider, edit its config, send a test. */
import { useEffect, useMemo, useState } from "react";
import { pluginGet, pluginPost } from "./api";

interface ProviderField {
	key: string;
	label: string;
	type: "string" | "secret" | "email";
	placeholder?: string;
	help?: string;
}
interface ConfigResp {
	activeProvider: string;
	providers: Array<{ id: string; label: string; fields: ProviderField[] }>;
	values: Record<string, Record<string, string>>;
	secretsSet: Record<string, Record<string, boolean>>;
}

const ui = {
	page: { maxWidth: 640, display: "flex", flexDirection: "column", gap: 18 } as const,
	card: {
		border: "1px solid var(--border, #e2e2e2)",
		borderRadius: 10,
		padding: 20,
		display: "flex",
		flexDirection: "column",
		gap: 14,
	} as const,
	row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } as const,
	label: { fontSize: 13, fontWeight: 600, display: "block" } as const,
	input: {
		width: "100%",
		padding: "8px 10px",
		borderRadius: 8,
		border: "1px solid var(--border, #ccc)",
		fontSize: 14,
	} as const,
	btn: {
		padding: "8px 14px",
		borderRadius: 8,
		border: "1px solid var(--border, #ccc)",
		background: "var(--accent, #111)",
		color: "#fff",
		fontSize: 14,
		fontWeight: 600,
		cursor: "pointer",
	} as const,
	btnGhost: {
		padding: "8px 14px",
		borderRadius: 8,
		border: "1px solid var(--border, #ccc)",
		background: "transparent",
		fontSize: 14,
		cursor: "pointer",
	} as const,
	help: { fontSize: 12, color: "#777", marginTop: 4 } as const,
};

export function EmailSettingsPage() {
	const [resp, setResp] = useState<ConfigResp | null>(null);
	const [active, setActive] = useState("");
	const [values, setValues] = useState<Record<string, Record<string, string>>>({});
	const [testTo, setTestTo] = useState("");
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	async function refresh() {
		const c = await pluginGet<ConfigResp>("config");
		setResp(c);
		setActive(c.activeProvider);
		setValues(c.values);
	}

	useEffect(() => {
		refresh()
			.catch((e) => setError(String(e?.message ?? e)))
			.finally(() => setLoading(false));
	}, []);

	const provider = useMemo(
		() => resp?.providers.find((p) => p.id === active),
		[resp, active],
	);

	function setField(providerId: string, key: string, value: string) {
		setValues((v) => ({ ...v, [providerId]: { ...(v[providerId] ?? {}), [key]: value } }));
	}

	function run(label: string, fn: () => Promise<void>) {
		setBusy(label);
		setError(null);
		setNotice(null);
		fn()
			.catch((e) => setError(String(e?.message ?? e)))
			.finally(() => setBusy(null));
	}

	function handleSave() {
		run("save", async () => {
			await pluginPost("config/save", { activeProvider: active, values });
			setNotice("Saved.");
			await refresh();
		});
	}

	function handleTest() {
		run("test", async () => {
			await pluginPost("test", { to: testTo });
			setNotice(`Test email sent to ${testTo}.`);
		});
	}

	if (loading) return <p style={{ padding: 20 }}>Loading email settings…</p>;

	return (
		<div style={ui.page}>
			<div>
				<h1 style={{ margin: "0 0 4px" }}>Email</h1>
				<p style={{ margin: 0, color: "#666" }}>
					Configure the email provider. Then activate <strong>this plugin</strong> under{" "}
					<em>Settings → Email</em> to make it the site's transport.
				</p>
			</div>

			{error && <div style={{ ...ui.card, borderColor: "#b3261e", color: "#b3261e" }}>{error}</div>}
			{notice && <div style={{ ...ui.card, borderColor: "#1a7f3c", color: "#1a7f3c" }}>{notice}</div>}

			<div style={ui.card}>
				<label style={ui.label}>
					Provider
					<select
						style={{ ...ui.input, marginTop: 6 }}
						value={active}
						onChange={(e) => setActive(e.target.value)}
					>
						{resp?.providers.map((p) => (
							<option key={p.id} value={p.id}>
								{p.label}
							</option>
						))}
					</select>
				</label>

				{provider?.fields.map((f) => {
					const secretSet = resp?.secretsSet?.[provider.id]?.[f.key];
					return (
						<label key={f.key} style={ui.label}>
							{f.label}
							<input
								style={{ ...ui.input, marginTop: 6 }}
								type={f.type === "secret" ? "password" : f.type === "email" ? "email" : "text"}
								value={values[provider.id]?.[f.key] ?? ""}
								placeholder={f.type === "secret" && secretSet ? "•••••••• (saved — leave blank to keep)" : f.placeholder}
								onChange={(e) => setField(provider.id, f.key, e.target.value)}
							/>
							{f.help && <div style={ui.help}>{f.help}</div>}
						</label>
					);
				})}

				<div style={ui.row}>
					<button style={ui.btn} onClick={handleSave} disabled={busy === "save"} type="button">
						{busy === "save" ? "Saving…" : "Save"}
					</button>
				</div>
			</div>

			<div style={ui.card}>
				<h2 style={{ margin: 0, fontSize: 16 }}>Send a test email</h2>
				<p style={{ margin: 0, color: "#666", fontSize: 13 }}>
					Sends through the selected provider using its saved config (independent of the
					Settings → Email selection).
				</p>
				<div style={ui.row}>
					<input
						style={{ ...ui.input, maxWidth: 280 }}
						type="email"
						placeholder="you@example.com"
						value={testTo}
						onChange={(e) => setTestTo(e.target.value)}
					/>
					<button
						style={ui.btnGhost}
						onClick={handleTest}
						disabled={busy === "test" || !testTo}
						type="button"
					>
						{busy === "test" ? "Sending…" : "Send test"}
					</button>
				</div>
			</div>
		</div>
	);
}
