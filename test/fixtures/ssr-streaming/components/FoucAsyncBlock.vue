<template>
  <div
    class="fouc-marker"
    data-testid="fouc-target"
  >
    {{ name }} (resolved after {{ delay }}ms)
  </div>
</template>

<script setup lang="ts">
// An async component whose SFC `<style>` only registers its module once the
// component renders — i.e. after the shell has already flushed. The streaming
// renderer therefore emits this CSS in the closing HTML, behind the component's
// own DOM. See `/fouc` and the FOUC streaming tests.
const { name, delay } = defineProps<{ name: string, delay: number }>()

await new Promise(resolve => setTimeout(resolve, import.meta.server ? delay : 0))
</script>

<style>
.fouc-marker {
  color: rgb(11, 22, 33);
  background: rgb(0, 220, 130);
  font-weight: 700;
}
</style>
