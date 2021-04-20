<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown" v-html="content.html" />
</template>

<script>
import { defineNuxtComponent } from '@nuxt/app'

export default defineNuxtComponent({
  props: {
    content: {
      type: Object,
      required: true
    }
  }
})
</script>

<style>
  .markdown h1 {
    @apply text-4xl;
  }

  .markdown h2 {
    @apply text-3xl;
  }

  .markdown h3 {
    @apply text-2xl;
  }

  .markdown h4 {
    @apply text-1xl;
  }

  .markdown blockquote {
    @apply border-l-2 border-primary-500 pl-2 ml-1;
  }

  .markdown code {
    @apply text-green-800 rounded;
  }

  .markdown code::before, .markdown code::after {
    content: "`";
  }
</style>
