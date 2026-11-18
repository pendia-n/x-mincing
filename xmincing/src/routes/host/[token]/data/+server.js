import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { authorizedHost, now, price } from '#lib/server/host-song.js';
import { sameOrigin } from '#lib/server/song-service.js';

const reply = (data, status = 200) =>
	json(data, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(event) {
	const room = sameOrigin(event) && (await authorizedHost(event));
	if (!room)
		return reply(
			{ message: 'Open this purchase in your original browser or enter your recovery code.' },
			403
		);
	const action = event.url.searchParams.get('action');
	if (action === 'checkout') {
		if (room.payment_status === 'paid') return reply({ paid: true });
		if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.OPENROUTER_API_KEY) {
			return reply({ message: 'Checkout is temporarily unavailable.' }, 503);
		}
		const fields = new URLSearchParams({
			mode: 'payment',
			'payment_method_types[0]': 'card',
			success_url: event.url.origin + event.url.pathname.slice(0, -5) + '?checkout=success',
			cancel_url: event.url.origin + event.url.pathname.slice(0, -5) + '?checkout=cancelled',
			'line_items[0][price_data][currency]': 'usd',
			'line_items[0][price_data][unit_amount]': String(price(room)),
			'line_items[0][price_data][product_data][name]': '30-second group song and lyric PDF',
			'line_items[0][quantity]': '1',
			'metadata[room_id]': room.id
		});
		const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
				'Idempotency-Key': 'host-song-' + room.id
			},
			body: fields
		});
		if (!response.ok) return reply({ message: 'Checkout could not start. Try again.' }, 502);
		const checkout = await response.json();
		await env.DB.prepare(
			"UPDATE song_rooms SET checkout_id=? WHERE id=? AND payment_status='unpaid'"
		)
			.bind(checkout.id, room.id)
			.run();
		return reply({ url: checkout.url });
	}
	if (action !== 'save' && action !== 'submit') return reply({ message: 'Unknown action.' }, 400);
	const time = now();
	if (!room.paid_at || room.paid_at + 1800 <= time || room.submitted_at) {
		return reply({ message: 'This entry window is closed.' }, 409);
	}
	const input = await event.request.json().catch(() => null);
	if (
		!Array.isArray(input) ||
		input.length !== room.capacity ||
		input.some(
			(entry) =>
				typeof entry?.name !== 'string' ||
				entry.name.length > 40 ||
				typeof entry?.answer !== 'string' ||
				entry.answer.length > 400 ||
				(action === 'submit' && !entry.answer.trim())
		)
	)
		return reply({ message: 'Enter one short response per player.' }, 400);
	const answers = input.map(({ name, answer }, index) => ({
		name: name.trim() || (index === 0 ? 'Host' : 'Guest ' + index),
		answer: answer.trim()
	}));
	const draft = action === 'save' ? input.map(({ name, answer }) => ({ name, answer })) : answers;
	const update = await env.DB.prepare(
		`UPDATE song_rooms SET host_answers=?, submitted_at=?
		WHERE id=? AND submitted_at IS NULL AND payment_status='paid' AND paid_at+1800>unixepoch()`
	)
		.bind(JSON.stringify(draft), action === 'submit' ? time : null, room.id)
		.run();
	return update.meta.changes
		? reply({ saved: true })
		: reply({ message: 'This entry window is closed.' }, 409);
}
