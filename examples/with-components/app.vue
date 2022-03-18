<template>
  <NuxtExampleLayout :show-tips="true" example="with-components">
    <h1 class="text-xl opacity-50">
      Auto Imported Components
    </h1>
    <div>
      <!-- Auto Imported Components -->
      <HelloWorld class="text-2xl" />
      <Nuxt3 class="text-2xl" />
      <ParentFolderHello class="mt-6" />
    </div>

    <template #tips>
      <div>
        Components under <code>components/</code> folder are auto imported and can be directly used in your templates.
        Read more about
        <NuxtLink to="https://v3.nuxtjs.org/docs/directory-structure/components" target="_blank">
          the components directory.
        </NuxtLink>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
