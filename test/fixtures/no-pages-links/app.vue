<script setup lang="ts">
const to = computed(() => String(useRoute().query.to ?? '/'))
</script>

<template>
  <div>
    <NuxtLink
      v-slot="{ href }"
      :to="to"
      custom
    >
      <a
        data-link="custom"
        :href="href"
      >custom</a>
    </NuxtLink>
    <NuxtLink
      data-link="default"
      :to="to"
    >
      default
    </NuxtLink>
    <NuxtLink
      data-link="blank"
      :to="to"
      target="_blank"
    >
      blank
    </NuxtLink>
  </div>
</template>
