import { getSignedInUser } from '#lib/server/identity.js';
import { reply } from '#lib/server/http.js';

export async function GET(event) {
	const user = await getSignedInUser(event);
	return reply({ user: user ? { id: user.id, username: user.username, createdAt: user.created_at } : null });
}
