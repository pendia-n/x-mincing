import { error } from '@sveltejs/kit';
import { toWebVtt } from '#lib/server/captions.js';
import { requireUser } from '#lib/server/http.js';
import { getRoomAccess } from '#lib/server/rooms.js';

export async function GET(event) {
	const user = await requireUser(event);
	const db = event.platform.env.DB;
	const access = await getRoomAccess(db, event.params.id, user.id);
	const clip = await db.prepare('SELECT participant_id, caption_text, duration_ms FROM clips WHERE id = ? AND room_id = ?')
		.bind(event.params.clipId, access.id).first();
	if (!clip || (clip.participant_id !== access.participant_id && access.status !== 'revealed')) error(404, 'This caption is not available yet.');
	return new Response(toWebVtt(clip.caption_text, clip.duration_ms), {
		headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
	});
}
