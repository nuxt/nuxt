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
      <ObjectPattern />
      <ObjectPatternDeclaration />
      <Halllo />
    </ClientOnly>
    <ClientOnly>
      <div class="should-be-treeshaken">
        this should not be visible
      </div>
      <ClientImport />
      <Treeshaken />
      <ResolvedImport />
      <FromArray />
      <Please />
      <Doo />
      <What />
      <Deep />
      <Pattern />
    </ClientOnly>
    <ButShouldNotBeTreeShaken />
    <Dont />
    <That />
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

const { ObjectPattern } = defineAsyncComponent(async () => {
  if (process.client) {
    return (await import('./../HelloWorld.vue'))
  }

  return {}
})

const { ObjectPattern: ObjectPatternDeclaration } = defineAsyncComponent(async () => {
  if (process.client) {
    return (await import('./../HelloWorld.vue'))
  }

  return {}
})

const { ObjectPattern: Halllo, ButShouldNotBeTreeShaken } = defineAsyncComponent(async () => {
  if (process.client) {
    return (await import('./../HelloWorld.vue'))
  }

  return {}
})
const isThis = {}

const { woooooo, What = isThis } = defineAsyncComponent(async () => {
  if (process.client) {
    return (await import('./../HelloWorld.vue'))
  }

  return {}
})

console.log(woooooo)

const { Deep, assignment: { Pattern = ofComponent } } = defineAsyncComponent(async () => {
  if (process.client) {
    return (await import('./../HelloWorld.vue'))
  }

  return {}
})

const [FromArray] = defineAsyncComponent(async () => {
  if (process.client) {
    return (await import('./../HelloWorld.vue'))
  }

  return {}
})

const [Please, { Dont, Doo }, That] = defineAsyncComponent(async () => {
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
