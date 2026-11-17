import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	JWT_SECRET: {
		description: 'HMAC signing key for app sessions. Keep it private; production uses the Cloudflare Worker secret.'
	}
});
