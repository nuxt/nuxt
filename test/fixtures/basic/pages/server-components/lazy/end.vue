<script setup lang="ts">
const page = ref<HTMLDivElement | undefined>()
const mountedHTML = ref()
onMounted(() => {
  mountedHTML.value = page.value?.innerHTML
})

const lazy = useRoute().query.lazy === 'true'
</script>

<template>
  <div ref="page" class="end-page">
    End page
    <pre>{{ mountedHTML }}</pre>
    <section>
      <AsyncServerComponent :lazy="lazy" :count="42" />
    </section>
  </div>
</template>
