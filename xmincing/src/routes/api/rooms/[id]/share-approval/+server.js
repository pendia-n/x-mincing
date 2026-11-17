import { error } from '@sveltejs/kit';
import { checkSameOrigin, readJson, reply, requireUser } from '#lib/server/http.js';
import { randomToken, sha256 } from '#lib/server/identity.js';
import { getRoomAccess } from '#lib/server/rooms.js';

export async function POST(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const { action } = await readJson(event);
	const db = event.platform.env.DB;
	const access = await getRoomAccess(db, event.params.id, user.id);
	if (access.status !== 'revealed') error(409, 'Sharing is available after the private reveal.');
	const now = Math.floor(Date.now() / 1000);
	if (action === 'revoke') {
		await db.batch([
			db.prepare('UPDATE participants SET share_approved_at = NULL WHERE id = ?').bind(access.participant_id),
			db.prepare('UPDATE share_links SET revoked_at = ? WHERE room_id = ? AND revoked_at IS NULL').bind(now, event.params.id)
		]);
		return reply({ approved: false, shareUrl: null });
	}
	if (action !== 'approve') error(400, 'Choose an available sharing action.');
	await db.prepare('UPDATE participants SET share_approved_at = ? WHERE id = ?').bind(now, access.participant_id).run();
	const approvals = await db.prepare('SELECT COUNT(*) AS count FROM participants WHERE room_id = ? AND share_approved_at IS NOT NULL')
		.bind(event.params.id).first();
	if (approvals.count < 2) return reply({ approved: true, bothApproved: false, shareUrl: null });

	await db.prepare('UPDATE share_links SET revoked_at = ? WHERE room_id = ? AND revoked_at IS NULL').bind(now, event.params.id).run();
	const token = randomToken(32);
	await db.prepare('INSERT INTO share_links (id, room_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
		.bind(crypto.randomUUID(), event.params.id, await sha256(token), now + 14 * 24 * 60 * 60, now).run();
	return reply({ approved: true, bothApproved: true, shareUrl: `${event.url.origin}/s/${token}` });
}
