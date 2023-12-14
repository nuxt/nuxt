<script setup>
definePageMeta({
  layoutTransition: false
})
</script>

<template>
  <div>
    <NuxtLayout
      name="with-props"
      some-prop="some prop was passed"
    >
      <div>
        some page content
      </div>
    </NuxtLayout>
  </div>
</template>
