<script lang="ts">
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

interface Props {
	post: ArticleArchiveType;
}

let { post }: Props = $props();

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
</script>

<div class="w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5 mb-12">
  <a 
    class="hover:shadow-xl p-2 block rounded-xl h-full duration-300" 
    href={post.isExternal ? post.externalUrl : `/${post.slug}`}
    target={post.isExternal ? "_blank" : "_self"}
    rel={post.isExternal ? "noopener noreferrer" : undefined}
    data-astro-prefetch={post.isExternal ? undefined : true}
  >
    <div class="flex justify-center items-center flex-col">
      <div class="relative z-10">
        <div class="relative">
          <div
            class="absolute rotate-6 -top-9 right-5 w-16 h-6 rounded-full text-white font-numbers bg-green flex items-center justify-center"
            style="view-transition-name: year-{post.slug};"
          >
            <p class="text-lg">{postYear}</p>
          </div>
          <div
            class="absolute -top-4 right-8 w-12 h-12 rounded-full text-white font-numbers bg-blue flex items-center justify-center"
            style="view-transition-name: day-{post.slug};"
          >
            <p class="text-xl">{postDay}</p>
          </div>
          <div
            class="absolute -top-6 right-16 w-8 h-8 rounded-full text-white font-numbers bg-pink flex items-center justify-center"
            style="view-transition-name: month-{post.slug};"
          >
            <p class="text-lg">{postMonth}</p>
          </div>
        </div>
      </div>
      <div>
        {#if post.feature_image}
          <img 
            src={post.feature_image} 
            width="500" 
            height="500" 
            class="object-cover w-40 h-40 rounded-md" 
            alt="記事サムネイル" 
            loading="lazy"
            style="view-transition-name: image-{post.slug};"
          />
        {:else if post.isExternal && post.source}
          {#if post.sourceColor && post.sourceColor.startsWith('#')}
            <div 
              class="w-40 h-40 rounded-md flex items-center justify-center font-bold text-white text-xl shadow-lg"
              style="background-color: {post.sourceColor}"
            >
              <span>{post.source?.slice(0, 5) || 'Blog'}</span>
            </div>
          {:else}
            <div 
              class="w-40 h-40 rounded-md flex items-center justify-center font-bold text-white text-xl shadow-lg {post.sourceColor || 'bg-gray-600'}"
            >
              <span>{post.source?.slice(0, 5) || 'Blog'}</span>
            </div>
          {/if}
        {:else}
          <div class="aspect-square h-40 object-cover bg-gray-200 rounded-md"></div>
        {/if}
      </div>
      <h3 
        class="text-xl text-black pt-2 text-wrap-balance text-center"
        style="view-transition-name: title-{post.slug};"
      >
        {post.title}
      </h3>
      {#if post.source}
        <div class="text-sm text-gray-500 mt-1">
          {post.source}
        </div>
      {/if}
    </div>
  </a>
</div>