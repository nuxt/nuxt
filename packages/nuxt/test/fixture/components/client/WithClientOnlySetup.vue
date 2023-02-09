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
    </ClientOnly>
    <ClientOnly>
      <div class="should-be-treeshaken">
        this should not be visible
      </div>
      <ClientImport />
      <Treeshaken />
      <ResolvedImport />
    </ClientOnly>
  </div>
</template>

<script setup>
import { Treeshaken } from 'somepath'
import HelloWorld from '../HelloWorld.vue'
import { Glob, ClientImport } from '#components'

const hello = 'world'
</script>

<style scoped>
    .not-client {
        color: "red";
    }
</style>
