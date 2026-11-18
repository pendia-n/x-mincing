import { env as workerEnv } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { findSong, openRouter, sameOrigin } from '#lib/server/song-service.js';
import { authorizedHost, prepareHostLyrics } from '#lib/server/host-song.js';
import { lyricPdf } from '#lib/server/lyric-pdf.js';

function decode64(value) {
	const str = atob(value);
	return Uint8Array.from(str, (c) => c.charCodeAt(0));
}
function syncsafe(n) {
	return [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
}
function frame(name, bytes) {
	const length = bytes.length;
	const result = new Uint8Array(10 + length);
	result.set(new TextEncoder().encode(name));
	result.set(
		[(length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, 0, 0],
		4
	);
	result.set(bytes, 10);
	return result;
}
function withCover(audio, image, mime, title) {
	const text = new TextEncoder();
	const titleFrame = frame(
		'TIT2',
		new Uint8Array([0, ...text.encode(title.replace(/[^\x20-\x7e]/g, '?'))])
	);
	const prefix = new Uint8Array([0, ...text.encode(mime), 0, 3, 0]);
	const cover = new Uint8Array(prefix.length + image.length);
	cover.set(prefix);
	cover.set(image, prefix.length);
	const picture = frame('APIC', cover);
	const size = titleFrame.length + picture.length;
	const result = new Uint8Array(10 + size + audio.length);
	result.set([73, 68, 51, 3, 0, 0, ...syncsafe(size)]);
	result.set(titleFrame, 10);
	result.set(picture, 10 + titleFrame.length);
	result.set(audio, 10 + size);
	return result;
}
export async function POST(event) {
	if (!sameOrigin(event)) return json({ message: 'Invalid request.' }, { status: 403 });
	const env = workerEnv;
	const room = (await authorizedHost(event)) || (await findSong(event, true));
	if (!room || room.payment_status !== 'paid')
		return json({ message: 'Payment is required.' }, { status: 403 });
	if (room.host_variations && !room.submitted_at)
		return json({ message: 'Submit your answers first.' }, { status: 409 });
	if (room.generation_status === 'complete') return json({ status: 'complete' });
	const now = Math.floor(Date.now() / 1000);
	const claim = await env.DB.prepare(
		"UPDATE song_rooms SET generation_status='running',generation_started_at=?,generation_error=NULL WHERE id=? AND (generation_status IN ('not_started','failed') OR (generation_status='running' AND generation_started_at<?))"
	)
		.bind(now, room.id, now - 600)
		.run();
	if (!claim.meta.changes) return json({ status: 'running' });
	return generate(env, room);
}

async function generate(env, room) {
	try {
		if (room.host_variations && !room.lyric_credits) await prepareHostLyrics(room);
		let audio = await env.MEDIA.get(`songs/${room.id}/audio.mp3`);
		if (!audio) {
			const response = await openRouter(env, 'chat/completions', {
				model: 'google/lyria-3-clip-preview',
				modalities: ['text', 'audio'],
				audio: { format: 'mp3' },
				stream: true,
				messages: [
					{ role: 'user', content: `${room.music_prompt}\nUse these lyrics:\n${room.lyrics}` }
				]
			});
			const stream = await response.text();
			let encoded = '';
			let finalLyrics = '';
			for (const line of stream.split('\n'))
				if (line.startsWith('data: ')) {
					const data = line.slice(6).trim();
					if (data === '[DONE]') continue;
					try {
						const part = JSON.parse(data);
						if (part.error) throw Error('Audio generation failed');
						const delta = part.choices?.[0]?.delta;
						encoded += delta?.audio?.data ?? '';
						finalLyrics += delta?.audio?.transcript ?? '';
					} catch (e) {
						if (e.message === 'Audio generation failed') throw e;
					}
				}
			if (!encoded) throw Error('Music provider returned no audio.');
			if (room.host_variations && !finalLyrics.trim()) {
				throw Error(
					'The music provider returned audio without lyric text. Retry generation to receive the final lyrics and PDF.'
				);
			}
			if (room.host_variations) {
				room.final_lyrics = finalLyrics.trim();
				room.lyric_credits = JSON.stringify(
					await attributeFinalLyrics(
						env,
						room.final_lyrics,
						room.host_answers,
						room.host_variations
					)
				);
				await env.DB.prepare('UPDATE song_rooms SET final_lyrics=?, lyric_credits=? WHERE id=?')
					.bind(room.final_lyrics, room.lyric_credits, room.id)
					.run();
			}
			await env.MEDIA.put(`songs/${room.id}/audio.mp3`, decode64(encoded), {
				httpMetadata: { contentType: 'audio/mpeg' }
			});
			audio = await env.MEDIA.get(`songs/${room.id}/audio.mp3`);
		}
		let art = await env.MEDIA.get(`songs/${room.id}/cover`);
		if (!art) {
			const response = await openRouter(env, 'images', {
				model: 'tencent/hy-image-v3.5-preview',
				prompt: room.image_prompt.slice(0, 500),
				n: 1,
				size: '1K',
				aspect_ratio: '1:1'
			});
			const data = await response.json();
			const encoded = data.data?.[0]?.b64_json;
			if (!encoded) throw Error('Image provider returned no image.');
			const bytes = decode64(encoded);
			const mime = bytes[0] === 137 ? 'image/png' : 'image/jpeg';
			await env.MEDIA.put(`songs/${room.id}/cover`, bytes, { httpMetadata: { contentType: mime } });
			art = await env.MEDIA.get(`songs/${room.id}/cover`);
		}
		const image = new Uint8Array(await art.arrayBuffer());
		const mime = art.httpMetadata?.contentType || 'image/png';
		const song = withCover(
			new Uint8Array(await audio.arrayBuffer()),
			image,
			mime,
			(room.final_lyrics || room.lyrics).split('\n')[0]
		);
		const key = `songs/${room.id}/finished.mp3`;
		await env.MEDIA.put(key, song, { httpMetadata: { contentType: 'audio/mpeg' } });
		if (room.host_variations) {
			const bytes = await lyricPdf(room, image, mime);
			await env.MEDIA.put(`songs/${room.id}/lyrics.pdf`, bytes, {
				httpMetadata: { contentType: 'application/pdf' }
			});
		}
		await env.DB.prepare(
			"UPDATE song_rooms SET generation_status='complete', lyrics=COALESCE(final_lyrics, lyrics), song_key=?, image_key=?, status='complete', ready_at=unixepoch() WHERE id=?"
		)
			.bind(key, `songs/${room.id}/cover`, room.id)
			.run();
		return json({ status: 'complete' });
	} catch (error) {
		await env.DB.prepare(
			"UPDATE song_rooms SET generation_status='failed',generation_error=? WHERE id=?"
		)
			.bind(String(error.message).slice(0, 200), room.id)
			.run();
		return json(
			{ message: 'Generation failed. Your payment is recorded; retry from this room.' },
			{ status: 502 }
		);
	}
}

async function attributeFinalLyrics(env, finalLyrics, hostAnswers, hostVariations) {
	const players = JSON.parse(hostAnswers).map((answer, index) => ({
		player: index + 1,
		name: answer.name,
		answer: answer.answer,
		variation: JSON.parse(hostVariations)[index]
	}));
	const lines = finalLyrics
		.split(/\r?\n/)
		.map((text, index) => ({ index, text }))
		.filter((line) => line.text.trim());
	const response = await openRouter(env, 'chat/completions', {
		model: 'inclusionai/ling-3.0-tiny',
		response_format: { type: 'json_object' },
		messages: [
			{
				role: 'system',
				content:
					'Attribute each supplied final lyric line to the player answers that inspired it. The lyric lines are fixed text from the music model. Do not rewrite, omit, reorder, or add words to any lyric. Return JSON with lines, an array containing one object per input line with the same index and exact same text and a players array of 1-based player numbers. Use an empty players array when no answer clearly inspired that line. Multiple players may inspire one line.'
			},
			{
				role: 'user',
				content: JSON.stringify({ players, lines })
			}
		]
	});
	const output = await response.json();
	const credited = new Map(
		(output.choices?.[0]?.message?.content
			? JSON.parse(output.choices[0].message.content).lines
			: []
		).map((line) => [line.index, line])
	);
	return lines.map((line) => {
		const attribution = credited.get(line.index);
		return {
			text: line.text.trim(),
			players: Array.isArray(attribution?.players)
				? [
						...new Set(
							attribution.players.filter(
								(player) => Number.isInteger(player) && player >= 1 && player <= players.length
							)
						)
					]
				: []
		};
	});
}
