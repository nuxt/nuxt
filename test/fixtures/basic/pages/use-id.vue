<script setup>
const id = useId()
</script>

<template>
  <div>
    <h2 :id="id">
      id: {{ id }}
    </h2>
    <ComponentWithIds />
    <ComponentWithIds />
    <ClientOnly><ComponentWithIds /></ClientOnly>
  </div>
</template>

