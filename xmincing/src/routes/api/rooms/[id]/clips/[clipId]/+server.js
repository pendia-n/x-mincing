import { error } from '@sveltejs/kit';
import { checkSameOrigin, mediaBucket, reply, requireUser } from '#lib/server/http.js';
import { promptsForRole } from '#lib/server/prompts.js';
import { getRoomAccess, refreshRoomStatus } from '#lib/server/rooms.js';

const MAX_CLIP_BYTES = 30 * 1024 * 1024;
const MAX_CLIP_DURATION_MS = 20_000;
const ALLOWED_TYPES = new Set(['video/webm', 'video/mp4', 'video/quicktime']);

export async function POST(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const db = event.platform.env.DB;
	const access = await getRoomAccess(db, event.params.id, user.id);
	if (access.status === 'revealed') error(409, 'The trailer has already been revealed.');
	if (event.request.headers.get('x-clip-consent') !== 'yes') error(400, 'Confirm you have permission to store this clip.');
	if (!promptsForRole(access.role).some((prompt) => prompt.slot === event.params.clipId)) error(403, 'That prompt is not assigned to your account.');
	const contentType = (event.request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!ALLOWED_TYPES.has(contentType)) error(415, 'Choose a WebM, MP4, or QuickTime video.');
	const size = Number(event.request.headers.get('content-length'));
	const duration = Number(event.request.headers.get('x-clip-duration-ms'));
	let captionText = '';
	try {
		const encoded = event.request.headers.get('x-clip-caption') ?? '';
		const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/');
		const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
		captionText = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))).trim();
	} catch {
		error(400, 'Add a short caption or sound description for accessibility.');
	}
	if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_CLIP_BYTES) error(413, 'Each clip must be smaller than 30 MB.');
	if (!Number.isFinite(duration) || duration < 500 || duration > MAX_CLIP_DURATION_MS) error(400, 'Each clip must be between half a second and 20 seconds.');
	if (!captionText || captionText.length > 500) error(400, 'Add a caption or sound description (up to 500 characters).');
	if (!event.request.body) error(400, 'Choose a video before uploading.');

	const bucket = mediaBucket(event);
	const old = await db.prepare('SELECT object_key FROM clips WHERE participant_id = ? AND prompt_slot = ?')
		.bind(access.participant_id, event.params.clipId).first();
	const objectKey = `${access.id}/${access.participant_id}/${event.params.clipId}/${crypto.randomUUID()}`;
	await bucket.put(objectKey, event.request.body, {
		httpMetadata: { contentType, cacheControl: 'private, no-store' },
		customMetadata: { roomId: access.id, participantId: access.participant_id }
	});
	const now = Math.floor(Date.now() / 1000);
	await db.prepare(
		`INSERT INTO clips (id, room_id, participant_id, prompt_slot, object_key, content_type, size_bytes, duration_ms, caption_text, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(participant_id, prompt_slot) DO UPDATE SET object_key = excluded.object_key,
		 content_type = excluded.content_type, size_bytes = excluded.size_bytes, duration_ms = excluded.duration_ms,
		 caption_text = excluded.caption_text, created_at = excluded.created_at`
	).bind(crypto.randomUUID(), access.id, access.participant_id, event.params.clipId, objectKey, contentType, size, Math.round(duration), captionText, now).run();
	await db.prepare('UPDATE participants SET recording_consent_at = COALESCE(recording_consent_at, ?) WHERE id = ?')
		.bind(now, access.participant_id).run();
	if (old?.object_key) await bucket.delete(old.object_key);
	await refreshRoomStatus(db, access.id);
	return reply({ ok: true });
}

export async function GET(event) {
	const user = await requireUser(event);
	const db = event.platform.env.DB;
	const access = await getRoomAccess(db, event.params.id, user.id);
	const clip = await db.prepare('SELECT participant_id, object_key, content_type FROM clips WHERE id = ? AND room_id = ?')
		.bind(event.params.clipId, access.id).first();
	if (!clip || (clip.participant_id !== access.participant_id && access.status !== 'revealed')) error(404, 'This clip is not available yet.');
	const object = await mediaBucket(event).get(clip.object_key);
	if (!object) error(404, 'This clip has expired.');
	return new Response(object.body, {
		headers: {
			'Content-Type': clip.content_type,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff',
			'Content-Disposition': 'inline'
		}
	});
}

export async function DELETE(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const db = event.platform.env.DB;
	const access = await getRoomAccess(db, event.params.id, user.id);
	if (access.status === 'revealed') error(409, 'Revealed clips are locked.');
	const clip = await db.prepare('SELECT id, object_key FROM clips WHERE id = ? AND room_id = ? AND participant_id = ?')
		.bind(event.params.clipId, access.id, access.participant_id).first();
	if (!clip) error(404, 'Clip not found.');
	await mediaBucket(event).delete(clip.object_key);
	await db.prepare('DELETE FROM clips WHERE id = ?').bind(clip.id).run();
	await refreshRoomStatus(db, access.id);
	return reply({ ok: true });
}
