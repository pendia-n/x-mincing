import { error } from '@sveltejs/kit';
import { checkSameOrigin, reply, requireUser } from '#lib/server/http.js';
import { getRoomAccess, makeInvitation } from '#lib/server/rooms.js';

export async function POST(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const db = event.platform.env.DB;
	const access = await getRoomAccess(db, event.params.id, user.id);
	if (access.owner_user_id !== user.id || access.status !== 'inviting') error(409, 'A new invite is only available before your partner joins.');
	await db.prepare('UPDATE invitations SET used_at = ? WHERE room_id = ? AND used_at IS NULL')
		.bind(Math.floor(Date.now() / 1000), event.params.id).run();
	const token = await makeInvitation(db, event.params.id);
	return reply({ inviteUrl: `${event.url.origin}/join/${token}` });
}
