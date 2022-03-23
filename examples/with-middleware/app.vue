<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <NuxtExampleLayout show-tips example="with-middleware">
    <NuxtPage />

    <template #nav>
      <nav class="flex align-center gap-4 p-4">
        <NuxtLink to="/" class="n-link-base">
          Home
        </NuxtLink>
        <NuxtLink to="/forbidden" class="n-link-base">
          Forbidden
        </NuxtLink>
        <NuxtLink to="/redirect" class="n-link-base">
          Redirect
        </NuxtLink>
      </nav>
    </template>

    <template #footer>
      <div class="text-center p-4 op-50">
        Current route: <code>{{ route.path }}</code>
      </div>
    </template>
    <template #tips>
      <div>
        <p>This example shows how to add route middleware with the <code>middleware/</code> directory or with a plugin, and how to use them globally or per page.</p>
        <a href="https://v3.nuxtjs.org/docs/directory-structure/middleware" target="_blank">
          Read more about middleware
        </a>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
