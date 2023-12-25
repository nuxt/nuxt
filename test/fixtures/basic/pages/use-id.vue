<script setup>
const id = useId()
</script>

<template>
  <form>
    <h2 :id="id">
      id: {{ id }}
    </h2>
    <LazyComponentWithIds />
    <ClientOnly><ComponentWithIds /></ClientOnly>
    <ComponentWithIds />
  </form>
</template>

