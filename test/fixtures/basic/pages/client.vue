<script setup lang="ts">
onMounted(() => import('~/components/BreaksServer'))
onBeforeMount(() => import('~/components/BreaksServer'))
onBeforeUpdate(() => import('~/components/BreaksServer'))
onRenderTracked(() => import('~/components/BreaksServer'))
onRenderTriggered(() => import('~/components/BreaksServer'))
onActivated(() => import('~/components/BreaksServer'))
onDeactivated(() => import('~/components/BreaksServer'))
onBeforeUnmount(() => import('~/components/BreaksServer'))
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
