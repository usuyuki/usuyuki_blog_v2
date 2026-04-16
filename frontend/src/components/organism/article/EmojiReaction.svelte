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
	let pickerWrapper = $state<HTMLDivElement | null>(null);
	let pickerOpenLeft = $state(true);
	let pickerCentered = $state(false);

	function handleOpenPicker() {
		showPicker = !showPicker;
		if (!showPicker || !pickerWrapper) return;
		// 画面幅が狭い場合は中央固定ポップアップ、広い場合はボタン基準の相対配置
		if (window.innerWidth < 600) {
			pickerCentered = true;
		} else {
			pickerCentered = false;
			const rect = pickerWrapper.getBoundingClientRect();
			const maxPickerWidth = Math.min(340, window.innerWidth - 32);
			pickerOpenLeft = rect.left + maxPickerWidth <= window.innerWidth - 16;
		}
	}

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

		Promise.all([
			import("emoji-picker-element"),
			import("emoji-picker-element/i18n/ja.js"),
		]).then(([{ Picker }, i18nModule]) => {
			if (destroyed || !container.isConnected) return;
			const p = new Picker({
				locale: "ja",
				dataSource: "/emoji-data-ja.json",
				i18n: {
					...i18nModule.default,
					searchLabel: "日本語か英語で検索できるよ",
				},
			}) as unknown as HTMLElement;

			p.addEventListener("emoji-click", (e: Event) => {
				const unicode = (e as CustomEvent<{ unicode: string }>).detail.unicode;
				showPicker = false;
				toggleReaction(unicode);
			});

			container.appendChild(p);
			picker = p;

			// 1文字のCJK文字（漢字・かな）でも検索できるようにする
			// emoji-picker-elementはMIN_SEARCH_TEXT_LENGTH=2のため1文字はフィルタされる
			// inputイベントを監視し、1文字CJK入力時に内部的に2文字として扱う
			p.addEventListener("input", () => {
				const shadowInput = p.shadowRoot?.querySelector(".search");
				if (!shadowInput) return;
				const val = (shadowInput as HTMLInputElement).value;
				if (val.length === 1 && /[\u3040-\u9fff\uf900-\ufaff]/.test(val)) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(p as any)._cmp?.$set({ rawSearchText: val + val });
				}
			});
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
			<p class="text-xs font-semibold text-gray-400 mb-2 tracking-wide">記事への反応</p>
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

			<div class="relative" bind:this={pickerWrapper}>
				<button
					class="flex items-center justify-center w-11 h-11 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
					onclick={handleOpenPicker}
					aria-label="絵文字を追加"
				>
					➕
				</button>

				{#if showPicker}
					{#if pickerCentered}
						<!-- 画面幅が狭い場合は中央固定ポップアップ -->
						<div
							class="fixed inset-0 z-20 flex items-center justify-center bg-black/20"
							onclick={() => (showPicker = false)}
							onkeydown={(e) => e.key === "Escape" && (showPicker = false)}
							role="presentation"
						>
							<div
								bind:this={pickerContainer}
								onclick={(e) => e.stopPropagation()}
							></div>
						</div>
					{:else}
						<div
							class="absolute bottom-full mb-2 z-10"
							class:left-0={pickerOpenLeft}
							class:right-0={!pickerOpenLeft}
							bind:this={pickerContainer}
						></div>
					{/if}
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
		--background: var(--white);
		--border-color: var(--brown);
		--button-active-background: color-mix(in srgb, var(--blue) 15%, var(--white));
		--button-hover-background: color-mix(in srgb, var(--brown) 15%, var(--white));
		--category-font-color: color-mix(in srgb, var(--brown) 70%, var(--black));
		--emoji-padding: 0.4rem;
		--indicator-color: var(--blue);
		--input-border-color: var(--brown);
		--input-font-color: var(--black);
		--input-placeholder-color: color-mix(in srgb, var(--brown) 60%, var(--white));
		--outline-color: var(--blue);
		--skintone-border-radius: 1rem;
	}
</style>
