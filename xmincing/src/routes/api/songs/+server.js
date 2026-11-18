import { env as workerEnv } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { randomToken, sha256 } from '#lib/server/identity.js';

import { setHostCookie } from '#lib/server/host-song.js';

export async function POST(event) {
	const origin = event.request.headers.get('origin');
	if (origin && origin !== event.url.origin)
		return json({ message: 'Invalid request origin.' }, { status: 403 });
	const db = workerEnv.DB;
	if (!db || !workerEnv.JWT_SECRET)
		return json({ message: 'Database unavailable.' }, { status: 503 });
	let input;
	try {
		input = await event.request.json();
	} catch {
		return json({ message: 'Invalid request.' }, { status: 400 });
	}
	const occasion = String(input.occasion ?? '').trim();
	const recipient = String(input.recipient ?? '').trim();
	const mood = String(input.mood ?? '').trim();
	const capacity = Number(input.capacity);
	const count = Number(input.variationCount);
	if (
		!recipient ||
		recipient.length > 80 ||
		!Number.isInteger(capacity) ||
		capacity < 2 ||
		capacity > 8 ||
		!Number.isInteger(count) ||
		count < 1 ||
		count > capacity
	)
		return json({ message: 'Please complete the form.' }, { status: 400 });
	const [occasionOption, moodOption] = await db.batch([
		db.prepare('SELECT id FROM song_occasions WHERE id = ?').bind(occasion),
		db.prepare('SELECT id FROM song_moods WHERE id = ?').bind(mood)
	]);
	if (!occasionOption.results.length || !moodOption.results.length) {
		return json({ message: 'Choose an occasion and mood from the list.' }, { status: 400 });
	}

	const { results } = await db
		.prepare('SELECT words FROM song_cue_sets WHERE occasion_id=? ORDER BY random() LIMIT ?')
		.bind(occasion, count)
		.all();
	if (results.length !== count)
		return json({ message: 'Variations are unavailable.' }, { status: 503 });
	const variations = Array.from({ length: capacity }, (_, index) =>
		JSON.parse(results[index % count].words)
	);
	const id = crypto.randomUUID();
	const host = randomToken();
	const now = Math.floor(Date.now() / 1000);
	await db
		.prepare(
			'INSERT INTO song_rooms (id, host_hash, invite_hash, occasion, recipient, mood, capacity, created_at, expires_at, host_variations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(
			id,
			await sha256(host),
			await sha256(randomToken()),
			occasion,
			recipient,
			mood,
			capacity,
			now,
			now + 604800,
			JSON.stringify(variations)
		)
		.run();
	await setHostCookie(event, id, host);
	return json({ hostUrl: '/host/' + host }, { headers: { 'Cache-Control': 'no-store' } });
}
