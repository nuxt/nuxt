<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <NuxtExampleLayout example="with-pages">
    <NuxtPage />

    <template #nav>
      <nav class="flex align-center gap-4 p-4">
        <NuxtLink to="/" class="n-link-base">
          Home
        </NuxtLink>
        <NuxtLink to="/about" class="n-link-base">
          About
        </NuxtLink>
        <NuxtLink to="/parent" class="n-link-base">
          Parent (index)
        </NuxtLink>
        <NuxtLink to="/parent/b" class="n-link-base">
          Parent (b)
        </NuxtLink>
      </nav>
    </template>

    <template #footer>
      <div class="text-center p-4 op-50">
        Current route: <code>{{ route.path }}</code>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
