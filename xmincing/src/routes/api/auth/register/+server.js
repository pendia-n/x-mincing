import { error } from '@sveltejs/kit';
import { checkSameOrigin, readJson, reply } from '#lib/server/http.js';
import { createSession, hashSecret } from '#lib/server/identity.js';
import { consumeIpQuota, newRecoveryCode, normalizeUsername, validUsername, validatePassword } from '#lib/server/auth-forms.js';

export async function POST(event) {
	checkSameOrigin(event);
	if (!event.platform?.env?.DB) error(503, 'Account storage is not connected yet.');
	const { username: rawUsername, password } = await readJson(event);
	const username = normalizeUsername(rawUsername);
	if (!validUsername(username)) error(400, 'Username must be 3 to 20 letters, numbers, or underscores.');
	if (!(await consumeIpQuota(event, 'signup', 6))) error(429, 'Too many account attempts. Try again in 15 minutes.');
	validatePassword(password);
	const db = event.platform.env.DB;
	const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
	if (existing) error(409, 'That username is already in use. Try another one.');

	const recoveryCode = newRecoveryCode();
	const passwordData = await hashSecret(password);
	const recoveryData = await hashSecret(recoveryCode);
	const userId = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);
	try {
		await db.prepare(
			`INSERT INTO users (id, username, password_hash, password_salt, password_iterations, recovery_hash, recovery_salt, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		).bind(userId, username, passwordData.hash, passwordData.salt, passwordData.iterations, recoveryData.hash, recoveryData.salt, now).run();
	} catch {
		error(409, 'That username is already in use. Try another one.');
	}
	await createSession(event, userId);
	return reply({ user: { id: userId, username }, recoveryCode }, 201);
}
