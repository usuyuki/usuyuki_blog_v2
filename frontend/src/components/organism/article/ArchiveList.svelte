<script lang="ts">
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";
import ArticleCard from "./ArticleCard.svelte";
import astroLogger from "~/libs/astroLogger";
import errorHandler from "~/libs/errorHandler";

interface Props {
	initialPosts: { [key: string]: ArticleArchiveType[] };
	initialMonthKeys: string[];
	initialNextBefore?: string | null;
}

let {
	initialPosts = {},
	initialMonthKeys = [],
	initialNextBefore = null,
}: Props = $props();

// Ensure safe initialization even if props are undefined during hydration
let posts = $state(initialPosts || {});
let monthKeys = $state(
	Array.isArray(initialMonthKeys) ? [...initialMonthKeys] : [],
);

let nextBefore = $state<string | null>(initialNextBefore || null);

// Computed month sections for safe rendering
let monthSections = $derived.by(() => {
	if (!monthKeys || !posts) return [];

	return monthKeys
		.map((monthKey) => {
			if (!monthKey || typeof monthKey !== "string") return null;

			const keyParts = monthKey.split("-");
			const year = keyParts[0];
			const month = keyParts[1];

			if (!year || !month) return null;

			const monthName = `${year}年${parseInt(month, 10)}月`;
			const monthPosts = posts[monthKey] || [];

			return {
				monthKey,
				monthName,
				monthPosts,
				hasData: monthPosts.length > 0,
			};
		})
		.filter(Boolean);
}); // 次のページの基準日付
let isLoading = $state(false);
let hasMorePosts = $state(true);

async function loadMorePosts() {
	if (isLoading || !hasMorePosts) {
		return;
	}

	isLoading = true;

	try {
		// beforeパラメータで日付ベースのページネーション
		const url = nextBefore
			? `/api/archive?before=${encodeURIComponent(nextBefore)}&limit=12`
			: "/api/archive?limit=12";

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		if (data.posts && data.posts.length > 0) {
			const groupedPosts: { [key: string]: ArticleArchiveType[] } = {};

			data.posts.forEach((post: ArticleArchiveType) => {
				// 外部記事と内部記事の日付処理を統一
				let dateToUse: Date;
				if (typeof post.published_at === "string") {
					dateToUse = new Date(post.published_at);
				} else {
					dateToUse = new Date(
						`${post.published_at.year}-${post.published_at.month.toString().padStart(2, "0")}-${post.published_at.day.toString().padStart(2, "0")}`,
					);
				}

				const monthKey = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, "0")}`;
				if (!groupedPosts[monthKey]) {
					groupedPosts[monthKey] = [];
				}
				groupedPosts[monthKey].push(post);
			});

			const newMonthKeys = Object.keys(groupedPosts).sort((a, b) =>
				b.localeCompare(a),
			);

			// 既存データにマージ（重複チェック付き）
			newMonthKeys.forEach((monthKey) => {
				if (posts[monthKey]) {
					// 既存記事との重複をチェック
					const newPosts = groupedPosts[monthKey].filter((newPost) => {
						const isDuplicate = posts[monthKey].some(
							(existingPost) =>
								existingPost.slug === newPost.slug ||
								(existingPost.isExternal &&
									newPost.isExternal &&
									existingPost.externalUrl === newPost.externalUrl),
						);
						return !isDuplicate;
					});

					if (newPosts.length > 0) {
						posts[monthKey] = [...posts[monthKey], ...newPosts];
					}
				} else {
					posts[monthKey] = groupedPosts[monthKey];
					monthKeys.push(monthKey);
				}
			});

			// 月キーを再ソート
			monthKeys = [...new Set(monthKeys)].sort((a, b) => b.localeCompare(a));

			// 次のページの基準日付を更新
			nextBefore = data.nextBefore;

			// APIからhasMoreの情報を使用
			hasMorePosts = data.hasMore !== false;
		} else {
			hasMorePosts = false;
		}
	} catch (error) {
		const err = error as Error;
		errorHandler.handleNetworkError(
			nextBefore
				? `/api/archive?before=${encodeURIComponent(nextBefore)}&limit=12`
				: "/api/archive?limit=12",
			err,
			{
				component: "ArchiveList",
				operation: "loadMorePosts",
				timestamp: new Date().toISOString(),
			},
		);
		hasMorePosts = false;
	} finally {
		isLoading = false;
	}
}

let observer: IntersectionObserver | null = null;

function setupIntersectionObserver(element: HTMLElement) {
	if (
		typeof window !== "undefined" &&
		typeof IntersectionObserver !== "undefined"
	) {
		if (observer) {
			observer.disconnect();
		}

		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && hasMorePosts && !isLoading) {
						loadMorePosts();
					}
				});
			},
			{
				rootMargin: "1000px",
				threshold: 0,
			},
		);

		observer.observe(element);
	}

	return {
		destroy() {
			if (observer) {
				observer.disconnect();
				observer = null;
			}
		},
	};
}
</script>

<div id="archive-content">
	{#each monthSections as section}
		{#if section && section.hasData}
			<section class="mb-12">
				<h2 class="text-2xl font-bold mb-6 text-center text-green">{section.monthName}</h2>
				<div class="flex flex-wrap items-stretch">
					{#each section.monthPosts as post}
						<ArticleCard {post} />
					{/each}
				</div>
			</section>
		{/if}
	{/each}
</div>

{#if hasMorePosts}
	<!-- Sentinel element for Intersection Observer -->
	<div 
		use:setupIntersectionObserver
		class="py-2"
		style="height: 1px;"
	></div>
	<div class="py-8 text-center">
		<button
			class="px-4 py-4 bg-blue text-white rounded-lg hover:shadow-xl duration-300 disabled:opacity-50"
			onclick={loadMorePosts}
			disabled={isLoading}
		>
			{isLoading ? '読み込み中...' : 'もっと!!'}
		</button>
	</div>
{/if}

