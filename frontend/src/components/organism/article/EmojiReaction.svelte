<script lang="ts">
	import { onMount } from "svelte";

	interface Props {
		slug: string;
	}

	interface Reaction {
		emoji: string;
		count: number;
		reacted: boolean;
	}

	let { slug }: Props = $props();

	let reactions = $state<Reaction[]>([]);
	let posting = $state<string | null>(null);
	let showPicker = $state(false);
	let loaded = $state(false);
	let bouncing = $state<string | null>(null);
	let pickerContainer = $state<HTMLDivElement | null>(null);

	onMount(async () => {
		try {
			const res = await fetch(`/api/reactions/${slug}`);
			if (res.ok) {
				const data = await res.json();
				reactions = data.reactions;
			}
		} finally {
			loaded = true;
		}
	});

	$effect(() => {
		const container = pickerContainer;
		if (!container) return;

		let destroyed = false;
		let picker: HTMLElement | null = null;

		import("emoji-picker-element").then(({ Picker }) => {
			if (destroyed || !container.isConnected) return;
			const p = new Picker() as unknown as HTMLElement;

			p.addEventListener("emoji-click", (e: Event) => {
				const unicode = (e as CustomEvent<{ unicode: string }>).detail.unicode;
				showPicker = false;
				toggleReaction(unicode);
			});

			container.appendChild(p);
			picker = p;
		});

		return () => {
			destroyed = true;
			picker?.remove();
			picker = null;
		};
	});

	async function toggleReaction(emoji: string) {
		if (posting) return;
		posting = emoji;
		bouncing = emoji;
		setTimeout(() => {
			bouncing = null;
		}, 300);

		const prev = reactions;
		const existing = reactions.find((r) => r.emoji === emoji);
		if (existing) {
			reactions = reactions
				.map((r) =>
					r.emoji === emoji
						? {
								...r,
								count: r.reacted ? r.count - 1 : r.count + 1,
								reacted: !r.reacted,
							}
						: r,
				)
				.filter((r) => r.count > 0);
		} else {
			reactions = [...reactions, { emoji, count: 1, reacted: true }];
		}

		try {
			const res = await fetch(`/api/reactions/${slug}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ emoji }),
			});
			if (res.ok) {
				const data = await res.json();
				reactions = data.reactions;
			} else {
				reactions = prev;
			}
		} catch {
			reactions = prev;
		} finally {
			posting = null;
		}
	}
</script>

<div class="w-full">
	{#if loaded}
		{#if reactions.length > 0}
			<p class="text-xs font-semibold text-gray-400 mb-2 tracking-wide">
				記事への反応
			</p>
		{:else}
			<p class="text-sm text-gray-400 py-1">絵文字で記事に反応できます</p>
		{/if}
		<div class="flex flex-wrap items-center gap-2">
			{#each reactions as reaction (reaction.emoji)}
				<button
					class="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm transition-all duration-150 min-w-11 min-h-11 cursor-pointer"
					class:bg-blue-50={reaction.reacted}
					class:border-blue-400={reaction.reacted}
					class:border-gray-200={!reaction.reacted}
					class:bounce={bouncing === reaction.emoji}
					onclick={() => toggleReaction(reaction.emoji)}
					disabled={posting !== null}
					aria-label="{reaction.emoji} {reaction.count}件"
					aria-pressed={reaction.reacted}
				>
					<span>{reaction.emoji}</span>
					<span class="font-numbers text-gray-600">{reaction.count}</span>
				</button>
			{/each}

			<div class="relative">
				<button
					class="flex items-center justify-center w-11 h-11 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
					onclick={() => (showPicker = !showPicker)}
					aria-label="絵文字を追加"
				>
					➕
				</button>

				{#if showPicker}
					<div
						class="absolute bottom-full mb-2 left-0 z-10"
						bind:this={pickerContainer}
					></div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="h-11 flex items-center">
			<span class="text-sm text-gray-300">みんなの反応を探し中...</span>
		</div>
	{/if}
</div>

<style>
	@keyframes bounce {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.3);
		}
	}

	.bounce {
		animation: bounce 0.3s ease;
	}

	:global(emoji-picker) {
		max-width: min(340px, calc(100vw - 2rem));
		--border-radius: 0.75rem;
	}
</style>
