import { requireUser, reply, checkSameOrigin } from '#lib/server/http.js';
import { PROMPT_PACK_VERSION } from '#lib/server/prompts.js';
import { makeInvitation, ROOM_LIFETIME } from '#lib/server/rooms.js';

export async function GET(event) {
	const user = await requireUser(event);
	const rows = await event.platform.env.DB.prepare(
		`SELECT r.id, r.status, r.created_at, r.expires_at, p.role,
		       (SELECT u.username FROM participants other JOIN users u ON u.id = other.user_id
		        WHERE other.room_id = r.id AND other.user_id != ?) AS partner_username,
		       (SELECT COUNT(*) FROM clips c WHERE c.room_id = r.id) AS clip_count
		 FROM rooms r JOIN participants p ON p.room_id = r.id
		 WHERE p.user_id = ? AND r.expires_at > ? AND r.status != 'deleted'
		 ORDER BY r.created_at DESC LIMIT 20`
	).bind(user.id, user.id, Math.floor(Date.now() / 1000)).all();
	return reply({ rooms: rows.results ?? [] });
}

export async function POST(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const db = event.platform.env.DB;
	const now = Math.floor(Date.now() / 1000);
	const roomId = crypto.randomUUID();
	await db.batch([
		db.prepare('INSERT INTO rooms (id, owner_user_id, status, prompt_pack_version, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
			.bind(roomId, user.id, 'inviting', PROMPT_PACK_VERSION, now, now + ROOM_LIFETIME),
		db.prepare('INSERT INTO participants (id, room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)')
			.bind(crypto.randomUUID(), roomId, user.id, 'A', now)
	]);
	const token = await makeInvitation(db, roomId);
	return reply({ roomId, inviteUrl: `${event.url.origin}/join/${token}` }, 201);
}
