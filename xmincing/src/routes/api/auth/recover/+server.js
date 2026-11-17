import { error } from '@sveltejs/kit';
import { authAttemptAllowed, clearAuthFailures, normalizeUsername, newRecoveryCode, recordAuthFailure, validatePassword } from '#lib/server/auth-forms.js';
import { checkSameOrigin, readJson, reply } from '#lib/server/http.js';
import { hashSecret, verifySecret } from '#lib/server/identity.js';

export async function POST(event) {
	checkSameOrigin(event);
	if (!event.platform?.env?.DB) error(503, 'Account storage is not connected yet.');
	const { username: rawUsername, recoveryCode, newPassword } = await readJson(event);
	const username = normalizeUsername(rawUsername);
	validatePassword(newPassword);
	if (!username || typeof recoveryCode !== 'string') error(400, 'Enter your username and recovery code.');
	if (!(await authAttemptAllowed(event, `recovery:${username}`))) error(429, 'Too many attempts. Try again in 15 minutes.');
	const db = event.platform.env.DB;
	const user = await db.prepare('SELECT id, recovery_hash, recovery_salt FROM users WHERE username = ?').bind(username).first();
	const valid = user && await verifySecret(recoveryCode.trim().toLowerCase(), user.recovery_salt, user.recovery_hash);
	if (!valid) {
		await recordAuthFailure(event, `recovery:${username}`);
		error(400, 'Those details did not match. Check them and try again.');
	}
	const passwordData = await hashSecret(newPassword);
	const nextRecoveryCode = newRecoveryCode();
	const recoveryData = await hashSecret(nextRecoveryCode);
	const now = Math.floor(Date.now() / 1000);
	await db.batch([
		db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, recovery_hash = ?, recovery_salt = ? WHERE id = ?')
			.bind(passwordData.hash, passwordData.salt, passwordData.iterations, recoveryData.hash, recoveryData.salt, user.id),
		db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(now, user.id)
	]);
	await clearAuthFailures(event, `recovery:${username}`);
	return reply({ ok: true, recoveryCode: nextRecoveryCode });
}
