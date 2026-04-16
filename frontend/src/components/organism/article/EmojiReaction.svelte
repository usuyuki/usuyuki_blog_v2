<script lang="ts">
	import { onMount } from "svelte";

	interface Props {
		slug: string;
		scrollable?: boolean;
	}

	interface Reaction {
		emoji: string;
		count: number;
		reacted: boolean;
	}

	let { slug, scrollable = false }: Props = $props();

	let reactions = $state<Reaction[]>([]);
	let posting = $state<string | null>(null);
	let showPicker = $state(false);
	let loaded = $state(false);
	let bouncing = $state<string | null>(null);
	let pickerContainer = $state<HTMLDivElement | null>(null);
	let pickerWrapper = $state<HTMLDivElement | null>(null);
	let pickerOpenLeft = $state(true);
	let pickerOpenDown = $state(false);
	let pickerCentered = $state(false);
	let reactionsContainer = $state<HTMLDivElement | null>(null);
	let collapsed = $state(true);
	let hasOverflow = $state(false);

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
			// ピッカーを上に開くと画面外に出る場合は下に開く（概算高さ 450px）
			pickerOpenDown = rect.top < 450;
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

	// 2行を超えたら「もっと見る」トグルを表示する
	// max-heightを一時解除して実際の行数をカウントし、正確に判定する
	$effect(() => {
		const el = reactionsContainer;
		if (!el) return;
		void reactions;
		requestAnimationFrame(() => {
			if (!el.isConnected) return;

			// max-heightを一時解除してアイテムの実際のoffsetTopを取得（forced reflow）
			// ブラウザは同一JSタスク内で再描画しないためちらつきは起きない
			el.style.maxHeight = "none";
			const items = Array.from(el.children) as HTMLElement[];
			let rowCount = 1;
			if (items.length > 1) {
				let prevTop = items[0].offsetTop;
				for (let i = 1; i < items.length; i++) {
					const top = items[i].offsetTop;
					if (top > prevTop + 4) {
						rowCount++;
						prevTop = top;
					}
				}
			}
			el.style.maxHeight = ""; // クラスによるmax-heightを復元

			const overflows = rowCount > 2;
			hasOverflow = overflows;
			if (!overflows) {
				collapsed = false; // 溢れない場合は制限不要
			}
			// 溢れる場合はcollapsedの現状を維持（初期true、ユーザー操作後はその値）
		});
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

			// 【背景】emoji-picker-elementはMIN_SEARCH_TEXT_LENGTH=2をハードコードしており、
			// 1文字の入力は検索クエリとして処理される前に内部でフィルタ・破棄される。
			// 日本語の漢字・かなは1文字で意味を持つ（「猫」「笑」等）ため、そのままでは検索不能。
			//
			// 【データ側の対処】build-emoji-data.mjsで1文字CJKタグを二重化（「猫」→「猫猫」）済み。
			// しかしユーザーが「猫」と入力してもクエリ自体が1文字として捨てられるため、
			// 「猫猫」タグがあっても「猫」ではヒットしない。
			//
			// 【このハックの必要性】ライブラリに検索テキストを外から設定するパブリックAPIが
			// 存在しないため、内部Svelteコンポーネント（_cmp）の$setを直接呼び出して
			// rawSearchTextを二重化した文字列に差し替えることで、MIN_SEARCH_TEXT_LENGTHを回避する。
			// Shadow DOM内のinput要素に直接値をセットする方法では内部の検索ロジックが発火しない。
			//
			// 【リスク】_cmpはemoji-picker-elementの非公開内部APIであり、ライブラリのバージョン
			// アップ（特にSvelteコンパイラ出力の変更）で動作しなくなる可能性がある。
			// その場合の劣化挙動: 1文字CJKでの検索結果が表示されないだけで、ピッカー自体は動作する。
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
			<!-- collapsed 時は overflow-hidden で 2行分にクリップ。
			     scrollable=true（PCサイドバー）かつ展開時のみ overflow-y-auto で 4行分を上限にスクロール。
			     max-h-28(112px) = 2行(96px) + py-2(16px)、max-h-52(208px) ≈ 4行分 -->
			<div
				class:overflow-hidden={collapsed || !scrollable}
				class:max-h-28={collapsed}
				class:overflow-y-auto={!collapsed && scrollable}
				class:max-h-52={!collapsed && scrollable}
			>
			<!-- 内側: アニメーション(scale 1.3)用に4辺 8px のバッファ確保。
				 px-2/py-2 (8px) > scale(1.3) の視覚的はみ出し幅(~6.5px) なのでクリップされない。
				 max-h-28(112px) = 2行(96px) + py-2(16px) で 2行をちょうど収める -->
			<div
				class="flex flex-wrap items-center gap-2 py-2 px-2"
				bind:this={reactionsContainer}
			>
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
			</div>
			</div>
		{:else}
			<p class="text-sm text-gray-400 py-1 text-center">絵文字で記事に反応できます</p>
		{/if}

		<div class="flex items-center gap-2 mt-2">
			{#if hasOverflow}
				<button
					class="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
					onclick={() => (collapsed = !collapsed)}
				>
					{collapsed ? "もっと見る ▼" : "閉じる ▲"}
				</button>
			{/if}
			<div class="relative" bind:this={pickerWrapper}>
				<button
					class="flex items-center justify-center w-11 h-11 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
					onclick={handleOpenPicker}
					aria-label="絵文字を追加"
				>
					➕
				</button>

				{#if showPicker && pickerCentered}
					<!-- 中央モード用オーバーレイ（タップで閉じる）。Pickerコンテナとは分離して軽量に保つ -->
					<div
						class="fixed inset-0 z-[19] bg-black/20"
						onclick={() => (showPicker = false)}
						onkeydown={(e) => e.key === "Escape" && (showPicker = false)}
						role="presentation"
					></div>
				{/if}
				<!-- ピッカーコンテナは常にDOMに保持し、表示切替はCSSで行う。
				     {#if showPicker} で囲むと開くたびに Picker インスタンスが再生成され、
				     絵文字データの再ロードが発生して表示が遅れる -->
				<div
					bind:this={pickerContainer}
					class:hidden={!showPicker}
					class:picker-centered={pickerCentered}
					class:absolute={!pickerCentered}
					class:bottom-full={!pickerCentered && !pickerOpenDown}
					class:top-full={!pickerCentered && pickerOpenDown}
					class:mb-2={!pickerCentered && !pickerOpenDown}
					class:mt-2={!pickerCentered && pickerOpenDown}
					class:z-10={!pickerCentered}
					class:left-0={!pickerCentered && pickerOpenLeft}
					class:right-0={!pickerCentered && !pickerOpenLeft}
				></div>
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

	/* 画面幅が狭い場合はビューポート中央に固定表示 */
	.picker-centered {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 20;
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
