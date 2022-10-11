<script setup lang="ts">
// explicit import to bypass client import protection
import BreaksServer from '../components/BreaksServer.client'

onMounted(() => import('~/components/BreaksServer.client'))
onBeforeMount(() => import('~/components/BreaksServer.client'))
onBeforeUpdate(() => import('~/components/BreaksServer.client'))
onRenderTracked(() => import('~/components/BreaksServer.client'))
onRenderTriggered(() => import('~/components/BreaksServer.client'))
onActivated(() => import('~/components/BreaksServer.client'))
onDeactivated(() => import('~/components/BreaksServer.client'))
onBeforeUnmount(() => import('~/components/BreaksServer.client'))
</script>

<template>
  <div>
    This page should not crash when rendered.
    <ClientOnly class="something">
      test
      <BreaksServer />
      <BreaksServer>Some slot content</BreaksServer>
    </ClientOnly>
    This should render.
    <div>
      <ClientOnly class="another">
        test
        <BreaksServer />
      </ClientOnly>
    </div>
  </div>
</template>
