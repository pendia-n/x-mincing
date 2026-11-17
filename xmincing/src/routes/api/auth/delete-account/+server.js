import { error } from '@sveltejs/kit';
import { checkSameOrigin, readJson, reply, requireUser } from '#lib/server/http.js';
import { clearSessionCookie, verifySecret } from '#lib/server/identity.js';

export async function POST(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const { password } = await readJson(event);
	const db = event.platform.env.DB;
	const account = await db.prepare('SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?')
		.bind(user.id).first();
	if (!(await verifySecret(password ?? '', account.password_salt, account.password_hash, account.password_iterations))) {
		error(400, 'Password did not match.');
	}
	const bucket = event.platform.env.MEDIA;
	if (!bucket) error(503, 'Video storage is temporarily unavailable. Try again later.');
	const roomRows = await db.prepare('SELECT DISTINCT r.id FROM rooms r JOIN participants p ON p.room_id = r.id WHERE p.user_id = ?')
		.bind(user.id).all();
	for (const room of roomRows.results ?? []) {
		const clips = await db.prepare('SELECT object_key FROM clips WHERE room_id = ?').bind(room.id).all();
		for (const clip of clips.results ?? []) await bucket.delete(clip.object_key);
		await db.prepare('DELETE FROM rooms WHERE id = ?').bind(room.id).run();
	}
	await db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
	clearSessionCookie(event);
	return reply({ ok: true });
}
