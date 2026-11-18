<script>
	import { onMount } from 'svelte';
	let { children } = $props();
	onMount(() => {
		if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
	});
</script>

<svelte:head
	><link rel="manifest" href="/manifest.webmanifest" /><link
		rel="apple-touch-icon"
		href="/app-192.png"
	/><link rel="icon" type="image/svg+xml" href="/mincing.svg" /><meta
		name="theme-color"
		content="#f8f3e9"
	/><meta name="viewport" content="width=device-width, initial-scale=1" /></svelte:head
>
<header>
	<a class="brand" href="/"><img src="/mincing.svg" alt="" /> xmincing</a>
	<nav><a href="/#why">Why</a><a href="/#how">How</a><a href="/#what">What</a></nav>
</header>
<main>{@render children()}</main>
<footer><span>Made for your people.</span><a href="/privacy">Privacy</a></footer>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(html) {
		background: #f8f3e9;
		color: #252124;
		font-family: system-ui, sans-serif;
		scroll-behavior: smooth;
	}
	:global(body) {
		margin: 0;
		min-width: 320px;
	}
	:global(a) {
		color: inherit;
	}
	header,
	footer {
		width: min(1200px, calc(100% - 40px));
		margin: auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	header {
		min-height: 90px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 800;
		text-decoration: none;
		font-size: 1.1rem;
	}
	.brand img {
		width: 46px;
		height: 46px;
	}
	nav {
		display: flex;
		gap: 26px;
	}
	nav a,
	footer a {
		text-decoration: none;
		font-size: 0.85rem;
	}
	main {
		width: min(1120px, calc(100% - 40px));
		margin: auto;
	}
	footer {
		padding: 28px 0;
		border-top: 1px solid #ddd2c3;
		font-size: 0.8rem;
		color: #706663;
	}
	@media (max-width: 600px) {
		header,
		footer,
		main {
			width: calc(100% - 28px);
		}
		nav {
			gap: 14px;
		}
	}
</style>
