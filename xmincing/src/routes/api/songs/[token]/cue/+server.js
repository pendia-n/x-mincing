import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { randomToken, sha256 } from '#lib/server/identity.js';
import { findSong, sameOrigin } from '#lib/server/song-service.js';
import { getCue, playerCookie } from '#lib/server/song-cues.js';

export async function POST(event) {
	if (!sameOrigin(event)) return json({ message: 'Invalid request.' }, { status: 403 });
	const room = await findSong(event);
	if (!room || room.status !== 'collecting')
		return json({ message: 'This room has closed.' }, { status: 404 });
	const previous = await getCue(event, room);
	if (previous)
		return json(
			{ words: JSON.parse(previous.words) },
			{ headers: { 'Cache-Control': 'no-store' } }
		);

	const token = randomToken();
	const hash = await sha256(token);
	const result = await env.DB.prepare(
		`
  INSERT INTO song_cue_assignments (id, room_id, player_hash, words)
  SELECT ?, r.id, ?, c.words
  FROM song_rooms r JOIN song_cue_sets c ON c.occasion_id = r.occasion
  WHERE r.id = ? AND r.status = 'collecting'
    AND r.expires_at > unixepoch()
    AND (SELECT count(*) FROM song_cue_assignments WHERE room_id = r.id) +
        (SELECT count(*) FROM song_contributions s WHERE s.room_id = r.id
          AND NOT EXISTS (SELECT 1 FROM song_cue_assignments a WHERE a.id = s.id)) < r.capacity
    AND NOT EXISTS (SELECT 1 FROM song_cue_assignments a WHERE a.room_id = r.id AND a.words = c.words)
  ORDER BY random()
  LIMIT 1
  RETURNING words`
	)
		.bind(crypto.randomUUID(), hash, room.id)
		.first();
	if (!result) return json({ message: 'All player slots are taken.' }, { status: 409 });

	event.cookies.set(playerCookie(event.params.token), token, {
		path: '/api/songs/' + event.params.token,
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: Math.max(0, room.expires_at - Math.floor(Date.now() / 1000))
	});
	return json({ words: JSON.parse(result.words) }, { headers: { 'Cache-Control': 'no-store' } });
}
