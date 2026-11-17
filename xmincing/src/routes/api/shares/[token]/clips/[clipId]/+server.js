import { error } from '@sveltejs/kit';
import { mediaBucket } from '#lib/server/http.js';
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
	const clip = await db.prepare('SELECT object_key, content_type FROM clips WHERE id = ? AND room_id = ?')
		.bind(event.params.clipId, link.room_id).first();
	if (!clip) error(404, 'This clip is not available.');
	const object = await mediaBucket(event).get(clip.object_key);
	if (!object) error(404, 'This clip has expired.');
	return new Response(object.body, { headers: {
		'Content-Type': clip.content_type,
		'Cache-Control': 'private, no-store',
		'X-Content-Type-Options': 'nosniff',
		'Content-Disposition': 'inline'
	} });
}
