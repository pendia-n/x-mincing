<script>
	import { onMount } from 'svelte';
	export let data;
	let occasion = 'birthday';
	let recipient = '';
	let mood = 'heartfelt';
	let capacity = 2;
	let busy = false;
	let message = '';
	let variationCount = 2;
	let customVariationCount = false;
	let resume = '';
	onMount(() => {
		try {
			const previous = localStorage.getItem('xmincing:last-host') || '';
			if (/^\/host\/[A-Za-z0-9_-]{43}$/.test(previous)) resume = previous;
		} catch {
			/* Starting a new song still works. */
		}
	});
	async function create() {
		busy = true;
		message = '';
		try {
			const response = await fetch('/api/songs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					occasion,
					recipient,
					mood,
					capacity: Number(capacity),
					variationCount: Math.min(variationCount, capacity)
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.message || 'Could not create the room.');
			window.location.assign(data.hostUrl);
		} catch (error) {
			message = error.message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Create a song | xmincing</title></svelte:head>
<section>
	<p class="label">MAKE IT TOGETHER</p>
	<h1>Start your song.</h1>
	{#if resume}<p><a href={resume}>Return to your last song</a></p>{/if}
	<form
		onsubmit={(event) => {
			event.preventDefault();
			create();
		}}
	>
		<label
			>Occasion<select bind:value={occasion}
				>{#each Object.entries(data.groups) as [category, occasions]}<optgroup label={category}
						>{#each occasions as option (option.id)}<option value={option.id}>{option.label}</option
							>{/each}</optgroup
					>{/each}</select
			></label
		><label>Who is it for?<input bind:value={recipient} maxlength="80" required /></label><label
			>Mood<select bind:value={mood}
				>{#each data.moods as option (option.id)}<option value={option.id}>{option.label}</option
					>{/each}</select
			></label
		><label
			>People, including you<select
				bind:value={capacity}
				onchange={(event) => {
					const size = Number(event.currentTarget.value);
					variationCount = customVariationCount ? Math.min(variationCount, size) : size;
				}}
				>{#each [2, 3, 4, 5, 6, 7, 8] as count}<option value={count}>{count}</option>{/each}</select
			></label
		>
		<label
			>Different variations
			<select bind:value={variationCount} onchange={() => (customVariationCount = true)}>
				{#each Array.from({ length: capacity }, (_, index) => index + 1) as count}
					<option value={count}>{count}</option>
				{/each}
			</select>
			<small>Choose fewer variations to give some players the same prompt.</small>
		</label><button class="button" disabled={busy}>{busy ? 'Creating…' : 'Prepare prompts'}</button>
	</form>
	{#if message}<p role="alert">{message}</p>{/if}
</section>

<style>
	section {
		max-width: 620px;
		margin: 60px auto;
	}
	h1 {
		font-size: 3rem;
		letter-spacing: -0.05em;
	}
	.label {
		font-size: 0.75rem;
		color: #d52b62;
		letter-spacing: 0.15em;
		font-weight: 800;
	}
	form,
	label {
		display: grid;
		gap: 10px;
	}
	form {
		gap: 20px;
	}
	input,
	select {
		width: 100%;
		padding: 14px;
		border: 1px solid #d2c8bb;
		border-radius: 8px;
		background: white;
		font: inherit;
	}
	label {
		margin-bottom: 18px;
		font-weight: 700;
	}
	.button {
		display: inline-block;
		border: 0;
		border-radius: 99px;
		padding: 15px 22px;
		background: #252124;
		color: white;
		text-decoration: none;
		font: inherit;
		cursor: pointer;
	}
</style>
