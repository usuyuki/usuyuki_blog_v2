<script lang="ts">
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

interface Props {
	post: ArticleArchiveType;
}

let { post }: Props = $props();

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
          <div class="absolute -top-4 right-12 w-10 h-10 rounded-md text-white font-numbers bg-blue flex items-center justify-center">
            <p class="text-xl">{postDay}</p>
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