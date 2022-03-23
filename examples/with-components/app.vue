<template>
  <NuxtExampleLayout show-tips example="with-components">
    <h1 class="text-xl opacity-50">
      Auto Imported Components
    </h1>
    <div>
      <!-- Auto Imported Components -->
      <HelloWorld class="text-2xl" />
      <Nuxt3 class="text-2xl" />
      <ParentFolderHello class="mt-6" />
      <NuxtWithPrefix class="mt-6" />
    </div>

    <template #tips>
      <div>
        <p>Components under <code>components/</code> directory are auto imported and can be directly used in your templates.</p>
        <p>Other directories can be configured to support components auto-imports</p>
        <p>
          Read more about
          <NuxtLink to="https://v3.nuxtjs.org/docs/directory-structure/components" target="_blank">
            the components directory.
          </NuxtLink>
        </p>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
