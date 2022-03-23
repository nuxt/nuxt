<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <NuxtExampleLayout show-tips example="with-pages">
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
        <button class="n-link-base" @click="$router.push(`/parent/reload-${(Math.random() * 100).toFixed()}`)">
          Keyed child
        </button>
        <button class="n-link-base" @click="$router.push(`/parent/static-${(Math.random() * 100).toFixed()}`)">
          Non-keyed child
        </button>
      </nav>
    </template>

    <template #footer>
      <div class="text-center p-4 op-50">
        Current route: <code>{{ route.path }}</code>
      </div>
    </template>

    <template #tips>
      <div>
        <p>This example shows how to use the <code>pages/</code> directory.</p>
        <a href="https://v3.nuxtjs.org/docs/directory-structure/pages" target="_blank">
          Read more about pages
        </a>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
