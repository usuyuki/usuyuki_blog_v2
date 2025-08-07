<script lang="ts">
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

interface Props {
	post: ArticleArchiveType;
}

let { post }: Props = $props();

let date = $derived(new Date(post.published_at));
let postDay = $derived(date.getDate());
</script>

<div class="w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5 mb-12">
  <a class="hover:shadow-xl p-2 block rounded-xl h-full duration-300" href="/{post.slug}">
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
          />
        {:else}
          <div class="aspect-square h-40 object-cover bg-gray-200 rounded-md"></div>
        {/if}
      </div>
      <h3 class="text-xl text-black pt-2 text-wrap-balance text-center">
        {post.title}
      </h3>
    </div>
  </a>
</div>