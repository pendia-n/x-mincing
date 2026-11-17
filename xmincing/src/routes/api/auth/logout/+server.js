import { checkSameOrigin, reply } from '#lib/server/http.js';
import { clearSessionCookie, SESSION_COOKIE, verifySessionToken } from '#lib/server/identity.js';

export async function POST(event) {
	checkSameOrigin(event);
	const token = event.cookies.get(SESSION_COOKIE);
	const claims = token ? await verifySessionToken(event, token) : null;
	if (claims && event.platform?.env?.DB) {
		await event.platform.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?')
			.bind(Math.floor(Date.now() / 1000), claims.jti).run();
	}
	clearSessionCookie(event);
	return reply({ ok: true });
}
