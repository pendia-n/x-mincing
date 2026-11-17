import { error } from '@sveltejs/kit';
import { checkSameOrigin, reply, requireUser } from '#lib/server/http.js';
import { getRoomAccess } from '#lib/server/rooms.js';

export async function POST(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const db = event.platform.env.DB;
	await getRoomAccess(db, event.params.id, user.id);
	const row = await db.prepare('SELECT COUNT(*) AS count FROM clips WHERE room_id = ?').bind(event.params.id).first();
	if (row.count !== 6) error(409, 'Both people need to finish all three clips before the reveal.');
	await db.prepare("UPDATE rooms SET status = 'revealed' WHERE id = ? AND status = 'ready'").bind(event.params.id).run();
	return reply({ ok: true });
}
