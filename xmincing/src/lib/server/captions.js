export function toWebVtt(text, durationMs) {
	const safeText = String(text ?? '')
		.replace(/\r?\n/g, ' ')
		.replace(/-->/g, '→')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.trim();
	const end = Math.min(20, Math.max(1, durationMs / 1000)).toFixed(3).padStart(6, '0');
	return `WEBVTT\n\n00:00:00.000 --> 00:00:${end}\n${safeText}\n`;
}
