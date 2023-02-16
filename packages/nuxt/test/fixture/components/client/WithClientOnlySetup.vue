<template>
  <div>
    <NotDotClientComponent>
      <ByeBye />
    </NotDotClientComponent>
    <div>
      <Glob />
    </div>
    {{ hello }}
    <div class="not-client">
      Hello
    </div>
    <DotClientComponent>
      <HelloWorld />
      <Glob />
      <SomeGlob />
      <SomeIsland />
      <NotToBeTreeShaken />
      <ObjectPattern />
      <ObjectPatternDeclaration />
      <AutoImportedNotTreeShakenComponent />
      <AutoImportedComponent />
      <Halllo />
      <Both />
      <AreTreeshaken />
    </DotClientComponent>
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
      <DontRemoveThisSinceItIsUsedInSetup />
    </ClientOnly>
    <ButShouldNotBeTreeShaken />
    <Dont />
    <That />
    <NotToBeTreeShaken />
    <AutoImportedNotTreeShakenComponent />
  </div>
</template>

<script setup>
import { Treeshaken } from 'somepath'
import HelloWorld from '../HelloWorld.vue'
import DontRemoveThisSinceItIsUsedInSetup from './ComponentWithProps.vue'
import { Glob, ClientImport } from '#components'
import { Both, AreTreeshaken } from '#imports'

const hello = 'world'
const ByeBye = defineAsyncComponent(() => import('./../some-glob.global.vue'))

const NotDotClientComponent = defineAsyncComponent(() => import('./../some.island.vue'))
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

console.log(DontRemoveThisSinceItIsUsedInSetup.props)
</script>

<style scoped>
    .not-client {
        color: "red";
    }
</style>
