import { env } from 'cloudflare:workers';

export const SESSION_COOKIE = 'xmincing_session';
export const SESSION_SECONDS = 65 * 24 * 60 * 60;
const ITERATIONS = 600_000;
const encoder = new TextEncoder();

function toBase64Url(bytes) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
	const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomToken(byteLength = 32) {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256(value) {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
	return toBase64Url(new Uint8Array(digest));
}

export async function hashSecret(value, salt = randomToken(16)) {
	const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(salt), iterations: ITERATIONS },
		key,
		256
	);
	return { salt, hash: toBase64Url(new Uint8Array(bits)), iterations: ITERATIONS };
}

export async function verifySecret(value, salt, expectedHash, iterations = ITERATIONS) {
	const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(salt), iterations },
		key,
		256
	);
	const actual = new Uint8Array(bits);
	const expected = fromBase64Url(expectedHash);
	let difference = actual.length ^ expected.length;
	for (let index = 0; index < Math.max(actual.length, expected.length); index += 1) {
		difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
	}
	return difference === 0;
}

function getJwtSecret(event) {
	const secret = event.platform?.env?.JWT_SECRET ?? env.JWT_SECRET;
	if (!secret || secret.length < 32)
		throw new Error('JWT_SECRET must be configured with at least 32 characters.');
	return secret;
}

async function hmacKey(secret, usages) {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		usages
	);
}

export async function signSession(event, userId) {
	const now = Math.floor(Date.now() / 1000);
	const claims = { sub: userId, jti: crypto.randomUUID(), iat: now, exp: now + SESSION_SECONDS };
	const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
	const body = toBase64Url(encoder.encode(JSON.stringify(claims)));
	const signingInput = `${header}.${body}`;
	const signature = await crypto.subtle.sign(
		'HMAC',
		await hmacKey(getJwtSecret(event), ['sign']),
		encoder.encode(signingInput)
	);
	return { token: `${signingInput}.${toBase64Url(new Uint8Array(signature))}`, claims };
}

export async function verifySessionToken(event, token) {
	try {
		const [headerPart, bodyPart, signaturePart, extra] = token.split('.');
		if (!headerPart || !bodyPart || !signaturePart || extra) return null;
		const header = JSON.parse(new TextDecoder().decode(fromBase64Url(headerPart)));
		if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
		const signingInput = `${headerPart}.${bodyPart}`;
		const valid = await crypto.subtle.verify(
			'HMAC',
			await hmacKey(getJwtSecret(event), ['verify']),
			fromBase64Url(signaturePart),
			encoder.encode(signingInput)
		);
		if (!valid) return null;
		const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(bodyPart)));
		if (
			!claims.sub ||
			!claims.jti ||
			!Number.isFinite(claims.exp) ||
			claims.exp <= Date.now() / 1000
		)
			return null;
		return claims;
	} catch {
		return null;
	}
}

export function setSessionCookie(event, token) {
	event.cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: SESSION_SECONDS
	});
}

export function clearSessionCookie(event) {
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function getSignedInUser(event) {
	const token = event.cookies.get(SESSION_COOKIE);
	if (!token) return null;
	const claims = await verifySessionToken(event, token);
	const db = event.platform?.env?.DB;
	if (!claims || !db) return null;
	const result = await db
		.prepare(
			`SELECT u.id, u.username, u.created_at, s.id AS session_id
			 FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > ?`
		)
		.bind(claims.jti, claims.sub, Math.floor(Date.now() / 1000))
		.first();
	return result ?? null;
}

export async function createSession(event, userId) {
	const { token, claims } = await signSession(event, userId);
	await event.platform.env.DB.prepare(
		'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
	)
		.bind(claims.jti, userId, claims.exp, claims.iat)
		.run();
	setSessionCookie(event, token);
}
