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
    <section data-testid="fallback">
      <AsyncServerComponent :lazy="lazy" :count="42">
        <template #fallback>
          Loading server component
        </template>
      </AsyncServerComponent>
    </section>
    <section data-testid="no-fallback">
      <AsyncServerComponent :lazy="lazy" :count="42" />
    </section>
  </div>
</template>
