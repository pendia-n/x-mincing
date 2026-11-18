<script>
	import { onMount, untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { data, form } = $props();
	let room = $derived(data.room);
	let answers = $state(
		untrack(
			() => data.room?.answers ?? data.room?.variations.map(() => ({ name: '', answer: '' })) ?? []
		)
	);
	let draftKey = $derived('xmincing:draft:' + page.params.token);
	$effect(() => {
		if (room?.submitted || expired) {
			try {
				sessionStorage.removeItem(draftKey);
			} catch {
				/* Storage can be disabled. */
			}
		}
	});
	let clock = $state(Math.floor(Date.now() / 1000));
	let busy = $state(false);
	let message = $state('');
	let copied = $state(-1);
	let saveState = $state('');
	let pending = Promise.resolve();
	let saveTimeout;
	let waitingPayment = $derived(page.url.searchParams.get('checkout') === 'success' && !room?.paid);
	let expired = $derived(room?.deadline !== null && room?.deadline <= clock);
	let staleJob = $derived(room?.started && room.started + 600 <= clock);

	onMount(() => {
		if (room) {
			try {
				localStorage.setItem('xmincing:last-host', page.url.pathname);
				const draft = sessionStorage.getItem(draftKey);
				if (room.paid && !room.submitted && !expired && draft) {
					const saved = JSON.parse(draft);
					if (Array.isArray(saved) && saved.length === room.variations.length) {
						answers = saved;
						save();
					}
				}
			} catch {
				/* Server drafts still work when browser storage is unavailable. */
			}
		}
		const timer = setInterval(() => {
			clock = Math.floor(Date.now() / 1000);
		}, 1000);
		const poll = setInterval(() => {
			if (waitingPayment || (room?.status === 'running' && !staleJob)) void invalidateAll();
		}, 3000);
		return () => {
			clearInterval(timer);
			clearInterval(poll);
			clearTimeout(saveTimeout);
		};
	});

	function prompt(words) {
		return `We're making a song for ${room.recipient}. The occasion is ${room.occasion}. Your variation is “${words.join(', ')}”. What memory or funny scene does it bring to mind? Reply with one sentence.`;
	}

	async function copy(value, index) {
		try {
			await navigator.clipboard.writeText(value);
			copied = index;
			message = '';
		} catch {
			message = 'Copy failed. You can select and copy the message below the button.';
		}
	}

	async function request(action, payload) {
		const response = await fetch(page.url.pathname + '/data?action=' + action, {
			method: 'POST',
			...(payload ? { headers: { 'content-type': 'application/json' }, body: payload } : {})
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.message || 'Try again.');
		return result;
	}

	function save() {
		clearTimeout(saveTimeout);
		saveState = 'Saving…';
		const snapshot = JSON.stringify(answers);
		pending = pending
			.catch(() => {})
			.then(() => request('save', snapshot))
			.then(
				() => {
					if (snapshot === JSON.stringify(answers)) saveState = 'Saved';
				},
				() => {
					saveState = 'Draft could not save. Edit again to retry.';
				}
			);
	}

	function scheduleSave() {
		clearTimeout(saveTimeout);
		saveState = 'Saving…';
		queueMicrotask(() => {
			try {
				sessionStorage.setItem(draftKey, JSON.stringify(answers));
			} catch {
				/* Server save continues. */
			}
			saveTimeout = setTimeout(save, 250);
		});
	}

	async function checkout() {
		busy = true;
		message = '';
		try {
			const result = await request('checkout');
			if (result.url) window.location.assign(result.url);
			else await invalidateAll();
		} catch (error) {
			message = error.message;
		} finally {
			busy = false;
		}
	}

	async function generate(submit = false) {
		busy = true;
		message = '';
		try {
			if (submit) {
				clearTimeout(saveTimeout);
				await pending;
				await request('submit', JSON.stringify(answers));
				await invalidateAll();
			}
			const response = await fetch('/api/songs/' + page.params.token + '/generate', {
				method: 'POST'
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.message || 'Generation could not finish.');
		} catch (error) {
			message = error.message;
		} finally {
			busy = false;
			await invalidateAll();
		}
	}

	function countdown(deadline) {
		const seconds = Math.max(0, deadline - clock);
		return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
	}
</script>

<svelte:head><title>Your song | xmincing</title></svelte:head>

<section>
	{#if !room}
		<h1>Unlock your purchase</h1>
		<p>Reopen this page where you created the song, or enter your eight-digit recovery code.</p>
		<form method="POST" action="?/recover">
			<label
				>Recovery code<input
					name="code"
					inputmode="numeric"
					pattern={'[0-9]{8}'}
					maxlength="8"
					required
				/></label
			>
			<button>Unlock</button>
		</form>
		{#if form?.message}<p role="alert">{form.message}</p>{/if}
	{:else}
		<p class="occasion">{room.occasion} · {room.mood}</p>
		<h1>A song for {room.recipient}</h1>
		{#if room.code}
			<details>
				<summary>Recovery for another browser</summary>
				<p>Keep this private page address and code together.</p>
				<code>{room.code}</code>
				<button
					class="secondary"
					onclick={() =>
						copy(page.url.origin + page.url.pathname + '\nRecovery code: ' + room.code, -2)}
					>{copied === -2 ? 'Copied' : 'Copy private recovery details'}</button
				>
			</details>
		{/if}
		{#if room.readyUntil}
			{#if room.readyUntil > clock}
				<h2>Your song is ready</h2>
				<p>Download both files within {countdown(room.readyUntil)}.</p>
				<div class="downloads">
					<a class="button" href={page.url.pathname + '/file/mp3'} download data-sveltekit-reload
						>Download MP3</a
					>
					<a
						class="button secondary"
						href={page.url.pathname + '/file/pdf'}
						download
						data-sveltekit-reload>Download lyric PDF</a
					>
				</div>
			{:else}<h2>Downloads expired</h2>
				<p>You can still share any file you already saved.</p>{/if}
		{:else if room.submitted}
			{#if busy || (room.status === 'running' && !staleJob)}
				<h2>Making your song…</h2>
				<p role="status">
					Keep this page open. Your downloads will appear here when both files are ready.
				</p>
			{:else}
				<h2>
					{room.status === 'failed' ? 'Generation needs a retry' : 'Your answers are submitted'}
				</h2>
				<button onclick={() => generate()}
					>{room.status === 'failed' ? 'Retry generation' : 'Generate song'}</button
				>
			{/if}
		{:else if room.paid && expired}
			<h2>The entry window has closed</h2>
			<p>This purchase’s 30 minutes ended before the answers were submitted.</p>
		{:else if room.paid}
			<h2>Enter everyone’s answers</h2>
			<p>
				{countdown(room.deadline)} left to submit ·
				<span role="status">{saveState || 'Drafts save automatically'}</span>
			</p>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					generate(true);
				}}
			>
				{#each room.variations as variation, index}
					<fieldset>
						<legend>{index === 0 ? 'You' : 'Guest ' + index}</legend>
						<p>{variation.join(' · ')}</p>
						<label
							>Name or nickname<input
								bind:value={answers[index].name}
								oninput={scheduleSave}
								maxlength="40"
								disabled={busy}
							/></label
						>
						<label
							>Answer<textarea
								bind:value={answers[index].answer}
								oninput={scheduleSave}
								maxlength="400"
								rows="2"
								required
								disabled={busy}></textarea></label
						>
					</fieldset>
				{/each}
				<button disabled={busy}>{busy ? 'Submitting…' : 'Submit and generate'}</button>
			</form>
		{:else}
			<h2>Collect everyone’s answers</h2>
			<p>
				Read each variation aloud or copy its prompt into WhatsApp. Ask for one sentence per person,
				including yourself.
			</p>
			{#each room.variations as variation, index}
				<article>
					<h3>{index === 0 ? 'Your variation' : 'Guest ' + index}</h3>
					<p class="words">{variation.join(' · ')}</p>
					{#if index > 0}
						<button class="secondary" onclick={() => copy(prompt(variation), index)}
							>{copied === index ? 'Copied' : 'Copy prompt'}</button
						>
						<details>
							<summary>View message</summary>
							<p>{prompt(variation)}</p>
						</details>
					{/if}
				</article>
			{/each}
			{#if waitingPayment}
				<p role="status">Confirming your payment…</p>
				<button class="secondary" onclick={() => invalidateAll()}>Check payment status</button>
			{:else}
				<p>
					Wait until you have all the answers. Once payment is confirmed, you have 30 minutes to
					enter and submit them. Both files are available for five minutes after generation.
				</p>
				<button onclick={checkout} disabled={busy}
					>{busy ? 'Opening checkout…' : 'Pay $' + (room.price / 100).toFixed(2) + ' once'}</button
				>
			{/if}
		{/if}
		{#if message}<p role="alert">{message}</p>{/if}
	{/if}
</section>

<style>
	section {
		max-width: 650px;
		margin: 36px auto 72px;
	}
	h1 {
		font-size: clamp(2.4rem, 7vw, 4rem);
		line-height: 1;
		letter-spacing: -0.05em;
		overflow-wrap: anywhere;
		margin: 0.3em 0;
	}
	.occasion {
		font-weight: 750;
		color: #a5234d;
	}
	p {
		line-height: 1.5;
	}
	article,
	fieldset {
		background: #fffaf1;
		border: 1px solid #dfd2c2;
		border-radius: 16px;
		padding: 16px;
		margin: 0 0 14px;
		min-width: 0;
	}
	h3,
	.words {
		margin: 0 0 7px;
	}
	legend {
		font-weight: 750;
	}
	label {
		display: grid;
		gap: 5px;
		margin: 10px 0;
		font-weight: 650;
	}
	input,
	textarea {
		width: 100%;
		font: inherit;
		padding: 10px;
		border: 1px solid #bfb1a4;
		border-radius: 8px;
		background: white;
		color: #252124;
	}
	button,
	.button {
		display: inline-block;
		background: #252124;
		color: white;
		border: 1px solid #252124;
		border-radius: 24px;
		padding: 11px 17px;
		font: inherit;
		text-decoration: none;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.secondary {
		background: transparent;
		color: #252124;
	}
	details {
		margin: 10px 0;
	}
	summary {
		cursor: pointer;
	}
	code {
		display: block;
		font-size: 1.3rem;
		margin: 10px 0;
	}
	.downloads {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
</style>
