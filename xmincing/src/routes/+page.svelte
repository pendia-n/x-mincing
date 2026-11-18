<svelte:head
	><title>xmincing — a song made together</title><meta
		name="description"
		content="Turn your shared memories into a song made together."
	/></svelte:head
>
<section class="hero">
	<div>
		<p class="label">A SONG MADE TOGETHER</p>
		<h1>More than one story.<br /><em>One song.</em></h1>
		<p class="intro">
			The little things you remember. The words your friends would choose. Bring them together in a
			song for someone you love.
		</p>
		<a href="/create" class="button">Create a song ↗</a>
		<p class="availability">Create together, from two to eight people.</p>
	</div>
	<div class="art" aria-hidden="true">
		<div class="disc"><div>✳</div></div>
		<span class="note one">“The coffee runs.”</span><span class="note two"
			>“Your terrible jokes.”</span
		><span class="note three">“Here's to what's next.”</span>
	</div>
</section>
<section class="why" id="why">
	<div>
		<p class="label">WHY</p>
		<h2>Some moments belong<br /><em>to all of us.</em></h2>
	</div>
	<p>
		A birthday, a goodbye, a shared joke. Everyone remembers something different. Put those little
		pieces together and make something you can give, keep and play again.
	</p>
</section>
<section class="steps" id="how">
	<p class="label">HOW</p>
	<h2>A little from everyone.</h2>
	<div class="cards">
		<article>
			<span>01</span>
			<h3>Invite your people</h3>
			<p>Choose an occasion and send each person a prompt in your group chat or in person.</p>
		</article>
		<article>
			<span>02</span>
			<h3>Collect the replies</h3>
			<p>The host pays once and enters everyone’s answers.</p>
		</article>
		<article>
			<span>03</span>
			<h3>Hear it together</h3>
			<p>Those ideas become a short song with its own cover.</p>
		</article>
	</div>
</section>
<section class="what" id="what">
	<div>
		<p class="label">WHAT</p>
		<h2>One song.<br /><em>Made by your people.</em></h2>
	</div>
	<p>
		A 30-second song for two to eight people, with a downloadable MP3 and illustrated lyric PDF. No
		account needed. Available for a limited time to save and share.
	</p>
</section>

<style>
	.label {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		color: #d52b62;
	}
	.hero {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: center;
		gap: 5vw;
		padding: 65px 0 80px;
	}
	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}
	h1,
	h2 {
		font-family: system-ui, sans-serif;
		letter-spacing: -0.055em;
	}
	h1 {
		font-size: clamp(3.5rem, 7vw, 6rem);
		line-height: 0.98;
		margin-bottom: 24px;
	}
	em {
		font-style: normal;
		color: #d52b62;
	}
	.intro {
		font-size: 1.1rem;
		line-height: 1.65;
		max-width: 470px;
		color: #625957;
	}
	.button {
		display: inline-flex;
		margin-top: 18px;
		padding: 16px 22px;
		border-radius: 99px;
		background: #252124;
		color: white;
		text-decoration: none;
		font-weight: 700;
	}
	.availability {
		font-size: 0.78rem;
		color: #716665;
		margin-top: 18px;
	}
	.art {
		min-height: 450px;
		background: #e9dfbd;
		border-radius: 28px;
		position: relative;
		overflow: hidden;
	}
	.disc {
		position: absolute;
		width: 320px;
		height: 320px;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: repeating-radial-gradient(circle, #303036 0 2px, #252229 3px 7px);
		box-shadow: 0 15px 32px #30242944;
		display: grid;
		place-items: center;
	}
	.disc div {
		display: grid;
		place-items: center;
		width: 115px;
		height: 115px;
		border-radius: 50%;
		background: #ee7992;
		color: #fff5e9;
		font-size: 3rem;
	}
	.note {
		position: absolute;
		background: #fffaf1;
		padding: 14px 20px;
		border-radius: 5px;
		box-shadow: 0 8px 25px #26202624;
		font-family: Georgia, serif;
	}
	.one {
		left: 6%;
		top: 19%;
		transform: rotate(-7deg);
	}
	.two {
		right: 3%;
		top: 37%;
		transform: rotate(6deg);
	}
	.three {
		left: 9%;
		bottom: 15%;
		transform: rotate(4deg);
	}
	.why {
		border-top: 1px solid #d8cfc2;
		padding: 80px 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12%;
		align-items: center;
	}
	.why h2,
	.what h2,
	.steps h2 {
		font-size: clamp(2.5rem, 5vw, 4rem);
		line-height: 1;
		margin-bottom: 0;
	}
	.why > p,
	.what > p {
		font-size: 1rem;
		line-height: 1.75;
		color: #625957;
	}
	.steps {
		padding: 60px 0;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-top: 32px;
	}
	.cards article {
		background: #fffaf2;
		border: 1px solid #e5dace;
		border-radius: 16px;
		padding: 25px;
		min-height: 190px;
	}
	.cards span {
		color: #d52b62;
	}
	.cards h3 {
		margin: 30px 0 10px;
	}
	.cards p {
		color: #706663;
		line-height: 1.6;
	}
	.what {
		margin: 35px 0 80px;
		background: #e9dfbd;
		border-radius: 24px;
		padding: 45px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 40px;
		align-items: center;
	}
	.what > p {
		margin: 0;
	}
	@media (max-width: 750px) {
		.hero,
		.why,
		.what {
			grid-template-columns: 1fr;
			gap: 30px;
		}
		.hero {
			padding: 35px 0 50px;
		}
		.art {
			min-height: 380px;
		}
		.disc {
			width: 265px;
			height: 265px;
		}
		.why {
			padding: 55px 0;
		}
		.cards {
			grid-template-columns: 1fr;
		}
		.cards article {
			min-height: 0;
		}
		.what {
			padding: 28px;
		}
	}
</style>
