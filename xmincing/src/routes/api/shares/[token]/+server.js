import { error } from '@sveltejs/kit';
import { reply } from '#lib/server/http.js';
import { allPrompts } from '#lib/server/prompts.js';
import { sha256 } from '#lib/server/identity.js';

export async function GET(event) {
	if (!event.platform?.env?.DB) error(503, 'Sharing is temporarily unavailable.');
	const db = event.platform.env.DB;
	const digest = await sha256(event.params.token);
	const now = Math.floor(Date.now() / 1000);
	const link = await db.prepare(
		`SELECT room_id FROM share_links WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`
	).bind(digest, now).first();
	if (!link) error(404, 'This share link is no longer available.');
	const approvals = await db.prepare('SELECT COUNT(*) AS count FROM participants WHERE room_id = ? AND share_approved_at IS NOT NULL')
		.bind(link.room_id).first();
	if (approvals.count !== 2) error(404, 'This share link is no longer available.');
	const members = await db.prepare('SELECT p.role, u.username FROM participants p JOIN users u ON u.id = p.user_id WHERE p.room_id = ? ORDER BY p.role')
		.bind(link.room_id).all();
	const clips = await db.prepare('SELECT id, participant_id, prompt_slot, content_type, duration_ms, caption_text FROM clips WHERE room_id = ? ORDER BY prompt_slot')
		.bind(link.room_id).all();
	return reply({
		members: members.results ?? [],
		prompts: allPrompts(),
		clips: (clips.results ?? []).map((clip) => ({
			...clip,
			url: `/api/shares/${event.params.token}/clips/${clip.id}`,
			captionUrl: `/api/shares/${event.params.token}/clips/${clip.id}/captions`
		}))
	});
}
