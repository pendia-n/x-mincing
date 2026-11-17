import { error } from '@sveltejs/kit';
import { authAttemptAllowed, clearAuthFailures, normalizeUsername, recordAuthFailure } from '#lib/server/auth-forms.js';
import { checkSameOrigin, readJson, reply } from '#lib/server/http.js';
import { createSession, verifySecret } from '#lib/server/identity.js';

export async function POST(event) {
	checkSameOrigin(event);
	if (!event.platform?.env?.DB) error(503, 'Account storage is not connected yet.');
	const { username: rawUsername, password } = await readJson(event);
	const username = normalizeUsername(rawUsername);
	if (!username || typeof password !== 'string') error(400, 'Enter your username and password.');
	if (!(await authAttemptAllowed(event, username))) error(429, 'Too many attempts. Try again in 15 minutes.');
	const user = await event.platform.env.DB.prepare(
		'SELECT id, username, password_hash, password_salt, password_iterations FROM users WHERE username = ?'
	).bind(username).first();
	const valid = user && await verifySecret(password, user.password_salt, user.password_hash, user.password_iterations);
	if (!valid) {
		await recordAuthFailure(event, username);
		error(401, 'Username or password did not match.');
	}
	await clearAuthFailures(event, username);
	await createSession(event, user.id);
	return reply({ user: { id: user.id, username: user.username } });
}
