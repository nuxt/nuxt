<script setup lang="ts">
const links = Array.from({ length: 300 }, (_, i) => i)
</script>

<template>
  <ul>
    <li
      v-for="i in links"
      :key="i"
    >
      <NuxtLink
        v-if="i % 10 === 9"
        :to="`https://example.com/${i}`"
      >
        external {{ i }}
      </NuxtLink>
      <NuxtLink
        v-else-if="i % 5 === 4"
        :to="{ path: `/blog/${i}`, query: { ref: 'links' }, hash: '#top' }"
      >
        query {{ i }}
      </NuxtLink>
      <NuxtLink
        v-else
        :to="`/product/${i}`"
      >
        page {{ i }}
      </NuxtLink>
    </li>
  </ul>
</template>
