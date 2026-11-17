import { error } from '@sveltejs/kit';
import { toWebVtt } from '#lib/server/captions.js';
import { sha256 } from '#lib/server/identity.js';

export async function GET(event) {
	const db = event.platform?.env?.DB;
	if (!db) error(503, 'Sharing is temporarily unavailable.');
	const now = Math.floor(Date.now() / 1000);
	const link = await db.prepare('SELECT room_id FROM share_links WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?')
		.bind(await sha256(event.params.token), now).first();
	if (!link) error(404, 'This share link is no longer available.');
	const approvals = await db.prepare('SELECT COUNT(*) AS count FROM participants WHERE room_id = ? AND share_approved_at IS NOT NULL')
		.bind(link.room_id).first();
	if (approvals.count !== 2) error(404, 'This share link is no longer available.');
	const clip = await db.prepare('SELECT caption_text, duration_ms FROM clips WHERE id = ? AND room_id = ?')
		.bind(event.params.clipId, link.room_id).first();
	if (!clip) error(404, 'This caption is not available.');
	return new Response(toWebVtt(clip.caption_text, clip.duration_ms), {
		headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
	});
}
