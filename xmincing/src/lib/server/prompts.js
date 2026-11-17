export const PROMPT_PACK_VERSION = 'v1';

const PROMPTS = {
	A: [
		{ slot: 'a1', title: 'The opening shot', prompt: 'Film a tiny detail that makes an ordinary place feel like the start of a story.' },
		{ slot: 'a2', title: 'A small victory', prompt: 'Show a quiet win. No explanation needed.' },
		{ slot: 'a3', title: 'The final clue', prompt: 'Give us one last image that changes how the first one feels.' }
	],
	B: [
		{ slot: 'b1', title: 'The unexpected entrance', prompt: 'Film something arriving, appearing, or being noticed for the first time.' },
		{ slot: 'b2', title: 'The plot twist', prompt: 'Show a harmless surprise from your day.' },
		{ slot: 'b3', title: 'The credits', prompt: 'End on a place or object you would want to remember.' }
	]
};

export function promptsForRole(role) {
	return PROMPTS[role] ?? [];
}

export function allPrompts() {
	return PROMPTS;
}
