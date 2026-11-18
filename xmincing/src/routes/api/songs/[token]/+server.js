import { env as workerEnv } from 'cloudflare:workers';
import { getCue } from '#lib/server/song-cues.js';
import { json } from '@sveltejs/kit';
import { sha256 } from '#lib/server/identity.js';

async function roomFor(event) {
	const hash = await sha256(event.params.token);
	return workerEnv.DB.prepare(
		'SELECT * FROM song_rooms WHERE (host_hash = ? OR invite_hash = ?) AND expires_at > ?'
	)
		.bind(hash, hash, Math.floor(Date.now() / 1000))
		.first();
}
export async function GET(event) {
	const room = await roomFor(event);
	if (!room) return json({ message: 'This link is invalid or has expired.' }, { status: 404 });
	const rows = await workerEnv.DB.prepare(
		'SELECT name FROM song_contributions WHERE room_id = ? ORDER BY created_at'
	)
		.bind(room.id)
		.all();
	const cue = await getCue(event, room);
	const [occasion, mood] = await workerEnv.DB.batch([
		workerEnv.DB.prepare('SELECT label FROM song_occasions WHERE id = ?').bind(room.occasion),
		workerEnv.DB.prepare('SELECT label FROM song_moods WHERE id = ?').bind(room.mood)
	]);
	const submitted =
		cue &&
		(await workerEnv.DB.prepare('SELECT 1 FROM song_contributions WHERE id = ?')
			.bind(cue.id)
			.first());
	return json(
		{
			occasion: occasion.results[0]?.label ?? room.occasion,
			words: cue ? JSON.parse(cue.words) : [],
			submitted: Boolean(submitted),
			recipient: room.recipient,
			mood: mood.results[0]?.label ?? room.mood,
			capacity: room.capacity,
			names: rows.results.map((row) => row.name),
			status: room.status,
			lyrics: room.lyrics,
			paymentStatus: room.payment_status,
			generationStatus: room.generation_status,
			isHost: room.host_hash === (await sha256(event.params.token)),
			expiresAt: room.expires_at
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
export async function POST(event) {
	const origin = event.request.headers.get('origin');
	if (origin && origin !== event.url.origin)
		return json({ message: 'Invalid request origin.' }, { status: 403 });
	const room = await roomFor(event);
	if (!room || room.status !== 'collecting')
		return json({ message: 'This room is unavailable.' }, { status: 404 });
	let input;
	try {
		input = await event.request.json();
	} catch {
		return json({ message: 'Invalid request.' }, { status: 400 });
	}
	const name = String(input.name ?? '').trim();
	const contribution = String(input.contribution ?? '').trim();
	if (!name || name.length > 40 || !contribution || contribution.length > 200)
		return json(
			{ message: 'Enter a name and a contribution of up to 200 characters.' },
			{ status: 400 }
		);
	const cue = await getCue(event, room);
	if (!cue) return json({ message: 'Get your cue words first.' }, { status: 409 });
	const id = cue.id;
	const result = await workerEnv.DB.prepare(
		"INSERT INTO song_contributions (id, room_id, token_hash, name, contribution, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM song_contributions WHERE room_id = ?) < ? AND (SELECT status FROM song_rooms WHERE id = ?) = 'collecting' ON CONFLICT(id) DO NOTHING"
	)
		.bind(
			id,
			room.id,
			await sha256(id),
			name,
			contribution,
			Math.floor(Date.now() / 1000),
			room.id,
			room.capacity,
			room.id
		)
		.run();
	if (!result.meta.changes) {
		const existing = await workerEnv.DB.prepare('SELECT 1 FROM song_contributions WHERE id = ?')
			.bind(id)
			.first();
		if (!existing) return json({ message: 'This room is full or closed.' }, { status: 409 });
	}
	return json({ ok: true });
}
