<script setup lang="ts" vapor>
</script>

<template>
  <div data-testid="vapor-custom-link-user">
    <NuxtLink
      v-slot="{ href, navigate, isActive }"
      to="/mixed"
      custom
    >
      <a
        data-testid="vapor-custom-link"
        :href="href"
        :class="{ active: isActive }"
        @click="navigate"
      >custom link</a>
    </NuxtLink>
  </div>
</template>
