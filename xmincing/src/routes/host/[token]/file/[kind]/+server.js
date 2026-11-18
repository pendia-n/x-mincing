import { env } from 'cloudflare:workers';
import { authorizedHost, now } from '#lib/server/host-song.js';

export async function GET(event) {
	const room = await authorizedHost(event);
	const headers = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' };
	if (!room?.ready_at || room.ready_at + 300 <= now())
		return new Response('Download unavailable.', { status: 404, headers });
	const kind = event.params.kind;
	if (kind !== 'mp3' && kind !== 'pdf')
		return new Response('File not found.', { status: 404, headers });
	const key = kind === 'mp3' ? room.song_key : 'songs/' + room.id + '/lyrics.pdf';
	const object = await env.MEDIA.get(key);
	if (!object) return new Response('File not found.', { status: 404, headers });
	return new Response(object.body, {
		headers: {
			...headers,
			'content-type': kind === 'mp3' ? 'audio/mpeg' : 'application/pdf',
			'content-disposition': 'attachment; filename="xmincing.' + kind + '"'
		}
	});
}
