<script lang="ts" setup>
import {
  //
  definePage
  // useRoute
} from 'vue-router/auto'

const route = useRoute('/')

definePageMeta({
  alias: '/home'
})
definePage({
  // alias: '/casa'
})
</script>

<template>
  <h1>Index</h1>
  <p>{{ route.params }}</p>
</template>
