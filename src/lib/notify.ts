/**
 * Notification channels (A0): homecore.toml's `[[notify.channels]]`, edited
 * with the same form engine as the rest of the config. homeCore doesn't yet
 * describe these itself, so their fields are described here, in its
 * vocabulary, from `hc-notify`'s config types.
 */
import type { Descriptor, Field } from './descriptor.js';

export type Provider = 'pushover' | 'email' | 'telegram';

export interface Channel {
	name: string;
	type: Provider | string;
	[field: string]: unknown;
}

const name: Field = {
	kind: 'text',
	key: 'name',
	label: 'Name',
	help: 'What automations call it. “all” is taken: it sends to every channel.',
	required: true
};

/** Each provider's fields, as `hc-notify` reads them. */
export const PROVIDERS: Record<Provider, { label: string; mark: string; fields: Field[] }> = {
	pushover: {
		label: 'Pushover',
		mark: 'PO',
		fields: [
			name,
			{
				kind: 'secret',
				key: 'user_key',
				label: 'User key',
				help: 'From your Pushover account — a user or a group.',
				required: true,
				secret: true
			},
			{
				kind: 'secret',
				key: 'api_token',
				label: 'App token',
				help: 'The application you registered for homeCore.',
				required: true,
				secret: true
			},
			{
				kind: 'text',
				key: 'device',
				label: 'Device',
				help: 'One device on the account. Empty sends to all of them.'
			},
			{
				kind: 'enum',
				key: 'priority',
				label: 'Priority',
				render: 'dropdown',
				default: 0,
				options: [
					{ value: -2, label: 'Lowest — no alert' },
					{ value: -1, label: 'Low — quiet' },
					{ value: 0, label: 'Normal' },
					{ value: 1, label: 'High — through quiet hours' },
					{ value: 2, label: 'Emergency — repeats until acknowledged' }
				]
			}
		]
	},
	email: {
		label: 'Email',
		mark: '@',
		fields: [
			name,
			{
				kind: 'host',
				key: 'smtp_host',
				label: 'SMTP server',
				placeholder: 'smtp.example.com',
				required: true
			},
			{ kind: 'port', key: 'smtp_port', label: 'SMTP port', default: 587 },
			{
				kind: 'toggle',
				key: 'starttls',
				label: 'STARTTLS',
				help: 'On for port 587. Off for implicit TLS, usually port 465.',
				default: true
			},
			{ kind: 'text', key: 'username', label: 'Username', required: true },
			{ kind: 'secret', key: 'password', label: 'Password', required: true, secret: true },
			{
				kind: 'text',
				key: 'from',
				label: 'From',
				placeholder: 'homeCore <house@example.com>',
				required: true
			},
			{
				kind: 'list',
				key: 'to',
				item: 'text',
				label: 'To',
				help: 'One or more addresses.',
				placeholder: 'someone@example.com',
				required: true
			}
		]
	},
	telegram: {
		label: 'Telegram',
		mark: 'TG',
		fields: [
			name,
			{
				kind: 'secret',
				key: 'bot_token',
				label: 'Bot token',
				help: 'From @BotFather.',
				required: true,
				secret: true
			},
			{
				kind: 'text',
				key: 'chat_id',
				label: 'Chat id',
				help: 'The chat the bot posts to: negative for a group, positive for a person.',
				required: true
			},
			{
				kind: 'toggle',
				key: 'markdown',
				label: 'Markdown',
				help: 'Format messages with Telegram’s MarkdownV2.',
				default: false
			}
		]
	}
};

export const isProvider = (t: string): t is Provider => t in PROVIDERS;

/** A provider's fields as a one-section descriptor, for the form engine. */
export function descriptorFor(type: string): Descriptor {
	const p = isProvider(type) ? PROVIDERS[type] : null;
	return {
		sections: [{ id: 'channel', title: p?.label ?? type, fields: p?.fields ?? [name] }]
	};
}

/** The channels in a parsed homecore.toml. */
export function channelsOf(parsed: unknown): Channel[] {
	const list = (parsed as { notify?: { channels?: unknown } } | null)?.notify?.channels;
	return Array.isArray(list) ? (list as Channel[]) : [];
}

/** A channel's form values: its fields, without `type` (which isn't edited). */
export function valuesOfChannel(c: Channel): Record<string, unknown> {
	const { type: _type, ...rest } = c;
	return rest;
}

/** A channel back from form values: `type` kept, empty values left out. */
export function channelOf(type: string, values: Record<string, unknown>): Channel {
	const out: Channel = { name: '', type };
	for (const [k, v] of Object.entries(values)) if (v !== undefined && v !== '') out[k] = v;
	// `name` first and `type` second, as hand-written files have them.
	const { name: n, type: t, ...rest } = out;
	return { name: n, type: t, ...rest };
}

/** What's wrong with a channel's name among the others, or null. */
export function nameProblem(n: string, others: Channel[]): string | null {
	const t = n.trim();
	if (t === '') return 'A channel needs a name.';
	if (t.toLowerCase() === 'all') return '“all” already means every channel.';
	if (others.some((c) => c.name === t)) return 'Another channel has that name.';
	return null;
}

/** One line under a channel's name: who or where it reaches. */
export function summary(c: Channel): string {
	switch (c.type) {
		case 'pushover':
			return c.device ? `device ${String(c.device)}` : 'every device on the account';
		case 'email': {
			const to = Array.isArray(c.to) ? c.to : [];
			return to.length === 0
				? `via ${String(c.smtp_host ?? '?')}`
				: to.length === 1
					? `to ${String(to[0])}`
					: `to ${to.length} addresses`;
		}
		case 'telegram':
			return `chat ${String(c.chat_id ?? '?')}`;
		default:
			return 'a provider this app doesn’t know';
	}
}

/**
 * The names of the rules with a Notify action that reaches `channel` —
 * naming it, or "all". Actions nest (conditions, parallel steps), so the
 * whole rule is searched.
 */
export function rulesSendingTo(
	rules: { id: string; name: string; actions?: unknown }[],
	channel: string
) {
	const reaches = (v: unknown): boolean => {
		if (Array.isArray(v)) return v.some(reaches);
		if (v === null || typeof v !== 'object') return false;
		const o = v as Record<string, unknown>;
		const n = o.Notify as { channel?: unknown } | undefined;
		if (n && (n.channel === channel || n.channel === 'all')) return true;
		return Object.values(o).some(reaches);
	};
	return rules.filter((r) => reaches(r.actions)).map((r) => ({ id: r.id, name: r.name }));
}

/** Sends a test through a running channel: null when it went, else why not. */
export async function sendTest(channel: string, message?: string): Promise<string | null> {
	try {
		const res = await fetch('/api/v1/notify/test', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ channel, ...(message?.trim() ? { message: message.trim() } : {}) })
		});
		if (res.ok) return null;
		const body = (await res.json().catch(() => ({}))) as { error?: unknown };
		const err = typeof body.error === 'string' ? body.error : `homeCore said no (${res.status}).`;
		// homeCore builds its channels when it starts; a new one isn't there yet.
		if (channel !== 'all' && (res.status === 503 || /not configured/i.test(err)))
			return `homeCore doesn’t have “${channel}” running — it reads channels when it starts. Restart it, then test.`;
		return err;
	} catch {
		return 'homeCore is not answering.';
	}
}
