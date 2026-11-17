import { checkSameOrigin, readJson, reply, requireUser } from '#lib/server/http.js';
import { acceptInvitation } from '#lib/server/rooms.js';

export async function POST(event) {
	checkSameOrigin(event);
	const user = await requireUser(event);
	const { token } = await readJson(event);
	if (typeof token !== 'string' || token.length < 20) return reply({ message: 'Invite link is incomplete.' }, 400);
	const roomId = await acceptInvitation(event.platform.env.DB, token, user.id);
	return reply({ roomId }, 201);
}
