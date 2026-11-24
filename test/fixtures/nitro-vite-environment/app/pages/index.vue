<script setup lang="ts">
import { state } from '#shared/state'

state.ssrSeen += 1
const sawNitro = state.marks.has('nitro')
state.marks.add('ssr')

const probe = `ssr=${state.ssrSeen} nitro=${state.nitroSeen} sawNitro=${sawNitro}`
</script>

<template>
  <div>nitro-vite-environment</div>
  <div id="shared-probe">
    {{ probe }}
  </div>
</template>
