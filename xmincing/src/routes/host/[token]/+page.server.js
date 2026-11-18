import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import {
	authorizedHost,
	lookupHost,
	now,
	price,
	recoveryCode,
	setHostCookie
} from '#lib/server/host-song.js';

export async function load(event) {
	event.setHeaders({
		'cache-control': 'private, no-store',
		'referrer-policy': 'same-origin',
		'x-robots-tag': 'noindex'
	});
	const room = await authorizedHost(event);
	if (!room) return { room: null };
	return {
		room: {
			occasion: room.occasion_label,
			recipient: room.recipient,
			mood: room.mood_label,
			variations: JSON.parse(room.host_variations),
			answers: JSON.parse(room.host_answers || 'null'),
			price: price(room),
			paid: room.payment_status === 'paid',
			submitted: Boolean(room.submitted_at),
			deadline: room.paid_at ? room.paid_at + 1800 : null,
			readyUntil: room.ready_at ? room.ready_at + 300 : null,
			status: room.generation_status,
			started: room.generation_started_at,
			code:
				room.paid_at &&
				(room.ready_at
					? room.ready_at + 300 > now()
					: room.submitted_at || room.paid_at + 1800 > now())
					? await recoveryCode(room.id)
					: null
		}
	};
}

export const actions = {
	recover: async (event) => {
		const code = String((await event.request.formData()).get('code') || '');
		const room = /^\d{8}$/.test(code) ? await lookupHost(event) : null;
		const denial = () => fail(403, { message: 'That code could not unlock this purchase.' });
		const time = now();
		if (
			!room?.paid_at ||
			(room.ready_at
				? room.ready_at + 300 <= time
				: !room.submitted_at && room.paid_at + 1800 <= time)
		)
			return denial();
		const attempt = await env.DB.prepare(
			`UPDATE song_rooms SET
			recovery_attempts=CASE WHEN recovery_reset_at<=? THEN 1 ELSE recovery_attempts+1 END,
			recovery_reset_at=CASE WHEN recovery_reset_at<=? THEN ? ELSE recovery_reset_at END
			WHERE id=? AND (recovery_reset_at<=? OR recovery_attempts<6)`
		)
			.bind(time, time, time + 900, room.id, time)
			.run();
		if (!attempt.meta.changes)
			return fail(429, { message: 'Too many attempts. Try again in 15 minutes.' });
		if (code !== (await recoveryCode(room.id))) return denial();
		await setHostCookie(event, room.id);
		redirect(303, event.url.pathname);
	}
};
