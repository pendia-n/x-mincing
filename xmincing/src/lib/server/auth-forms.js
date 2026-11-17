import { error } from '@sveltejs/kit';
import { hashSecret, randomToken, sha256 } from './identity.js';

export function normalizeUsername(value) {
	return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validUsername(username) {
	return /^[a-z0-9_]{3,20}$/.test(username);
}

export function validatePassword(password) {
	if (typeof password !== 'string' || password.length < 7 || password.length > 18) {
		error(400, 'Use 7 to 18 characters for your password.');
	}
	if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
		error(400, 'Add at least one letter and one number to your password.');
	}
}

export function newRecoveryCode() {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

async function limitKey(event, username) {
	const ip = event.request.headers.get('cf-connecting-ip') ?? 'unknown';
	return sha256(`${username}:${ip}`);
}

export async function authAttemptAllowed(event, username) {
	const db = event.platform.env.DB;
	const key = await limitKey(event, username);
	const now = Math.floor(Date.now() / 1000);
	const row = await db.prepare('SELECT locked_until FROM auth_limits WHERE key_hash = ?').bind(key).first();
	return !row?.locked_until || row.locked_until <= now;
}

export async function recordAuthFailure(event, username) {
	const db = event.platform.env.DB;
	const key = await limitKey(event, username);
	const now = Math.floor(Date.now() / 1000);
	const windowSeconds = 15 * 60;
	const row = await db.prepare('SELECT attempts, window_started_at FROM auth_limits WHERE key_hash = ?').bind(key).first();
	if (!row || now - row.window_started_at >= windowSeconds) {
		await db.prepare(
			`INSERT INTO auth_limits (key_hash, attempts, window_started_at, locked_until) VALUES (?, 1, ?, NULL)
			 ON CONFLICT(key_hash) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at, locked_until = NULL`
		).bind(key, now).run();
		return;
	}
	const attempts = row.attempts + 1;
	await db.prepare('UPDATE auth_limits SET attempts = ?, locked_until = ? WHERE key_hash = ?')
		.bind(attempts, attempts >= 8 ? now + windowSeconds : null, key)
		.run();
}

export async function clearAuthFailures(event, username) {
	const key = await limitKey(event, username);
	await event.platform.env.DB.prepare('DELETE FROM auth_limits WHERE key_hash = ?').bind(key).run();
}

export async function consumeIpQuota(event, scope, limit = 6) {
	const db = event.platform.env.DB;
	const ip = event.request.headers.get('cf-connecting-ip') ?? 'unknown';
	const key = await sha256(`${scope}:${ip}`);
	const now = Math.floor(Date.now() / 1000);
	const windowSeconds = 15 * 60;
	const row = await db.prepare('SELECT attempts, window_started_at, locked_until FROM auth_limits WHERE key_hash = ?').bind(key).first();
	if (row?.locked_until && row.locked_until > now) return false;
	if (!row || now - row.window_started_at >= windowSeconds) {
		await db.prepare(
			`INSERT INTO auth_limits (key_hash, attempts, window_started_at, locked_until) VALUES (?, 1, ?, NULL)
			 ON CONFLICT(key_hash) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at, locked_until = NULL`
		).bind(key, now).run();
		return true;
	}
	const attempts = row.attempts + 1;
	await db.prepare('UPDATE auth_limits SET attempts = ?, locked_until = ? WHERE key_hash = ?')
		.bind(attempts, attempts >= limit ? now + windowSeconds : null, key).run();
	return attempts < limit;
}

export async function hashRecoveryCode(code) {
	return hashSecret(code);
}
