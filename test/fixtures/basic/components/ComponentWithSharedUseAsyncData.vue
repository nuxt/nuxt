<script setup lang="ts">
import { useSharedAsyncData } from '../composables/asyncDataTests'
const { data, pending } = useSharedAsyncData()
</script>

<template>
  <div>
    <div id="componentWithSharedUseAsyncData__data">
      {{ data }}
    </div>
    <div id="componentWithSharedUseAsyncData__pending">
      {{ pending }}
    </div>
  </div>
</template>
