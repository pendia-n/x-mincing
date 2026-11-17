import { error, json } from '@sveltejs/kit';
import { getSignedInUser } from './identity.js';

export function reply(data, status = 200) {
	return json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function requireUser(event) {
	if (!event.platform?.env?.DB) error(503, 'The app database is not connected yet.');
	const user = await getSignedInUser(event);
	if (!user) error(401, 'Sign in to continue.');
	return user;
}

export async function readJson(event) {
	try {
		return await event.request.json();
	} catch {
		error(400, 'Please send valid form data.');
	}
}

export function checkSameOrigin(event) {
	const origin = event.request.headers.get('origin');
	if (origin && origin !== event.url.origin) error(403, 'This request could not be verified.');
}

export function mediaBucket(event) {
	const bucket = event.platform?.env?.MEDIA;
	if (!bucket) error(503, 'Private video storage is not connected yet.');
	return bucket;
}
