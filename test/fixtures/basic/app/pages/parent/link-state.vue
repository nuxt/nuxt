<script setup lang="ts">
const cases = {
  inactive: '/nuxt-link/trailing-slash',
  active: '/parent',
  exact: '/parent/link-state',
  query: '/parent/link-state?a=1',
}
</script>

<template>
  <div>
    <template
      v-for="(to, name) in cases"
      :key="name"
    >
      <NuxtLink
        :to="to"
        :data-nuxt-link="name"
      >
        nuxt
      </NuxtLink>
      <RouterLink
        :to="to"
        :data-router-link="name"
      >
        router
      </RouterLink>
    </template>
  </div>
</template>
