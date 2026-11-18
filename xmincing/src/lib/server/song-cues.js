import { env } from 'cloudflare:workers';
import { sha256 } from '#lib/server/identity.js';

export function playerCookie(token) {
	return 'song_player_' + token.slice(0, 16);
}

export async function getCue(event, room) {
	const token = event.cookies.get(playerCookie(event.params.token));
	if (!token) return null;

	const hash = await sha256(token);
	return env.DB.prepare(
		'SELECT id, words FROM song_cue_assignments WHERE room_id = ? AND player_hash = ?'
	)
		.bind(room.id, hash)
		.first();
}
