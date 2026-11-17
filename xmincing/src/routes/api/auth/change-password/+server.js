import { error } from '@sveltejs/kit';
import { validatePassword } from '#lib/server/auth-forms.js';
import { checkSameOrigin, readJson, reply, requireUser } from '#lib/server/http.js';
import { hashSecret, verifySecret } from '#lib/server/identity.js';

export async function POST(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const { currentPassword, newPassword } = await readJson(event);
	validatePassword(newPassword);
	const db = event.platform.env.DB;
	const row = await db.prepare('SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?').bind(user.id).first();
	if (!(await verifySecret(currentPassword ?? '', row.password_salt, row.password_hash, row.password_iterations))) {
		error(400, 'Current password did not match.');
	}
	const updated = await hashSecret(newPassword);
	const now = Math.floor(Date.now() / 1000);
	await db.batch([
		db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ? WHERE id = ?')
			.bind(updated.hash, updated.salt, updated.iterations, user.id),
		db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL')
			.bind(now, user.id, user.session_id)
	]);
	return reply({ ok: true, note: 'Your other signed-in sessions have been closed.' });
}
