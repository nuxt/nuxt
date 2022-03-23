<template>
  <NuxtExampleLayout show-tips example="with-layouts">
    <template #nav>
      <nav class="flex align-center gap-4 p-4">
        <NuxtLink to="/default">
          Default layout
        </NuxtLink>
        <NuxtLink to="/custom">
          Custom layout
        </NuxtLink>
        <NuxtLink to="/dynamic">
          Dynamic layout
        </NuxtLink>
      </nav>
    </template>

    <template #tips>
      <div>
        <p>This example shows how to define default and custom layouts.</p>
        <a href="https://v3.nuxtjs.org/docs/directory-structure/layouts" target="_blank">
          Read more about layouts
        </a>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
