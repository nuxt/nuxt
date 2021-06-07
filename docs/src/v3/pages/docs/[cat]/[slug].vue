<template>
  <div>
    <ul class="breadcrumb mb-3">
      <li v-for="p in (slug || '').split('/').filter(Boolean)" :key="p">
        {{ p }}
      </li>
    </ul>
    <NuxtContent :content="content" />
  </div>
</template>

<script>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { defineNuxtComponent } from '@nuxt/app'
import { useContent, NuxtContent } from '~/modules/content/runtime'

export default defineNuxtComponent({
  components: {
    NuxtContent
  },
  setup () {
    const route = useRoute()

    // Slug and page data
    const slug = computed(() => route.fullPath + '.md')
    const { data: content } = useContent(slug.value)

    return {
      slug,
      content
    }
  }
})
</script>

<style scroped>
  .breadcrumb li {
    display: inline;
    /* padding: 0 .2em; */
  }

  .breadcrumb li+li::before {
    padding: 0 .5em;
    @apply text-gray-400;
    content: "/";
  }
</style>
