<script lang="ts">
	import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

	interface Props {
		post: ArticleArchiveType;
	}

	let { post }: Props = $props();

	// Ensure safe property access during hydration
	let safePost = $derived({
		...post,
		source: post.source ?? undefined,
		sourceColor: post.sourceColor ?? undefined,
		isExternal: post.isExternal ?? false,
	});

	let postYear = $derived(
		typeof post.published_at === "string"
			? new Date(post.published_at).getFullYear()
			: post.published_at.year,
	);

	let postMonth = $derived(
		typeof post.published_at === "string"
			? new Date(post.published_at).getMonth() + 1
			: post.published_at.month,
	);

	let postDay = $derived(
		typeof post.published_at === "string"
			? new Date(post.published_at).getDate()
			: post.published_at.day,
	);

	let imageError = $state(false);

	function handleImageError() {
		imageError = true;
	}
</script>

<div class="w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5 mb-12">
  <a 
    class="hover:shadow-xl p-2 block rounded-xl h-full duration-300" 
    href={safePost.isExternal ? safePost.externalUrl : `/${safePost.slug}`}
    target={safePost.isExternal ? "_blank" : "_self"}
    rel={safePost.isExternal ? "noopener noreferrer" : undefined}
    data-astro-prefetch={safePost.isExternal ? undefined : true}
  >
    <div class="flex justify-center items-center flex-col">
      <div class="relative z-10">
        <div class="relative">
          <div
            class="absolute rotate-6 -top-9 right-5 w-16 h-6 rounded-full text-white font-numbers bg-green flex items-center justify-center"
            style="view-transition-name: year-{safePost.slug};"
          >
            <p class="text-lg">{postYear}</p>
          </div>
          <div
            class="absolute -top-4 right-8 w-12 h-12 rounded-full text-white font-numbers bg-blue flex items-center justify-center"
            style="view-transition-name: day-{safePost.slug};"
          >
            <p class="text-xl">{postDay}</p>
          </div>
          <div
            class="absolute -top-6 right-16 w-8 h-8 rounded-full text-white font-numbers bg-pink flex items-center justify-center"
            style="view-transition-name: month-{safePost.slug};"
          >
            <p class="text-lg">{postMonth}</p>
          </div>
        </div>
      </div>
      <div>
        {#if safePost.feature_image && !imageError}
          <img 
            src={safePost.feature_image} 
            width="500" 
            height="500" 
            class="object-cover w-40 h-40 rounded-md" 
            alt="記事サムネイル" 
            loading="lazy"
            style="view-transition-name: image-{safePost.slug};"
            onerror={handleImageError}
          />
        {:else if (safePost.feature_image && imageError) || (!safePost.feature_image && safePost.isExternal && safePost.source)}
          {#if safePost.sourceColor && safePost.sourceColor.startsWith('#')}
            <div 
              class="w-40 h-40 rounded-md flex items-center justify-center font-bold text-white text-xl shadow-lg"
              style="background-color: {safePost.sourceColor}"
            >
              <span>{safePost.source ? safePost.source.slice(0, 5) : 'Blog'}</span>
            </div>
          {:else}
            <div 
              class="w-40 h-40 rounded-md flex items-center justify-center font-bold text-white text-xl shadow-lg {safePost.sourceColor || 'bg-gray-600'}"
            >
              <span>{safePost.source ? safePost.source.slice(0, 5) : 'Blog'}</span>
            </div>
          {/if}
        {:else if safePost.feature_image && imageError}
          <div 
            class="w-40 h-40 rounded-md flex items-center justify-center font-bold text-white text-xl shadow-lg bg-gray-600"
          >
            <span>No Image</span>
          </div>
        {:else}
          <div class="aspect-square h-40 object-cover bg-gray-200 rounded-md"></div>
        {/if}
      </div>
      <h3 
        class="text-xl text-black pt-2 text-wrap-balance text-center"
        style="view-transition-name: title-{safePost.slug};"
      >
        {safePost.title}
      </h3>
      {#if safePost.source}
        <div class="text-sm text-gray-500 mt-1">
          {safePost.source}
        </div>
      {/if}
    </div>
  </a>
</div>