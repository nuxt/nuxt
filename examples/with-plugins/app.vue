<template>
  <NuxtExampleLayout example="with-plugins" show-tips>
    <div>{{ $myPlugin() }}</div>

    <template #tips>
      <div>
        <p>This example shows how to use the <code>plugins/</code> directory to auto-register plugins.</p>
        <a href="https://v3.nuxtjs.org/docs/directory-structure/plugins" target="_blank">
          Read more about plugins
        </a>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
