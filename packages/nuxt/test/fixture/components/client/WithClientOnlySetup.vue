<template>
  <div>
    <div>
      <Glob />
    </div>
    {{ hello }}
    <div class="not-client">
      Hello
    </div>
    <ClientOnly>
      <HelloWorld />
      <Glob />
      <SomeGlob />
      <SomeIsland />
      <NotToBeTreeShaken />
    </ClientOnly>
    <ClientOnly>
      <div class="should-be-treeshaken">
        this should not be visible
      </div>
      <ClientImport />
      <Treeshaken />
      <ResolvedImport />
    </ClientOnly>
    <NotToBeTreeShaken />
  </div>
</template>

<script setup>
import { Treeshaken } from 'somepath'
import HelloWorld from '../HelloWorld.vue'
import { Glob, ClientImport } from '#components'

const hello = 'world'

const SomeIsland = defineAsyncComponent(async () => {
  if (process.client) {
    return (await import('./../some.island.vue'))
  }

  return {}
})

const NotToBeTreeShaken = defineAsyncComponent(async () => {
  if (process.client) {
    return (await import('./../HelloWorld.vue'))
  }

  return {}
})
</script>

<style scoped>
    .not-client {
        color: "red";
    }
</style>
