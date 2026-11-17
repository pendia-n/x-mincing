import { error } from '@sveltejs/kit';
import { checkSameOrigin, reply, requireUser } from '#lib/server/http.js';
import { promptsForRole } from '#lib/server/prompts.js';
import { getRoomAccess } from '#lib/server/rooms.js';
import { mediaBucket } from '#lib/server/http.js';

export async function GET(event) {
	const user = await requireUser(event);
	const db = event.platform.env.DB;
	const access = await getRoomAccess(db, event.params.id, user.id);
	const memberRows = await db.prepare(
		`SELECT p.id, p.user_id, p.role, p.share_approved_at, u.username
		 FROM participants p JOIN users u ON u.id = p.user_id WHERE p.room_id = ? ORDER BY p.role`
	).bind(event.params.id).all();
	const clipRows = await db.prepare(
		'SELECT id, participant_id, prompt_slot, content_type, size_bytes, duration_ms, caption_text, created_at FROM clips WHERE room_id = ? ORDER BY prompt_slot'
	).bind(event.params.id).all();
	const own = promptsForRole(access.role);
	const members = memberRows.results ?? [];
	const other = members.find((member) => member.user_id !== user.id);
	const clips = clipRows.results ?? [];
	const revealed = access.status === 'revealed';
	return reply({
		room: { id: access.id, status: access.status, createdAt: access.created_at, expiresAt: access.expires_at },
		self: { id: access.participant_id, role: access.role, username: user.username, shareApproved: Boolean(access.share_approved_at) },
		partner: other ? { username: other.username, shareApproved: Boolean(other.share_approved_at) } : null,
		prompts: own,
		otherPrompts: revealed && other ? promptsForRole(other.role) : [],
		clips: clips.filter((clip) => revealed || clip.participant_id === access.participant_id).map((clip) => ({
			...clip,
			isMine: clip.participant_id === access.participant_id,
			url: `/api/rooms/${access.id}/clips/${clip.id}`,
			captionUrl: `/api/rooms/${access.id}/clips/${clip.id}/captions`
		})),
		storageReady: Boolean(event.platform.env.MEDIA)
	});
}

export async function DELETE(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const db = event.platform.env.DB;
	const access = await getRoomAccess(db, event.params.id, user.id);
	if (access.owner_user_id !== user.id) error(403, 'Only the room creator can close this room.');
	const clips = await db.prepare('SELECT object_key FROM clips WHERE room_id = ?').bind(event.params.id).all();
	const media = mediaBucket(event);
	for (const clip of clips.results ?? []) await media.delete(clip.object_key);
	await db.prepare('DELETE FROM rooms WHERE id = ?').bind(event.params.id).run();
	return reply({ ok: true });
}
