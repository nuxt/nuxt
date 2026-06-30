<template>
  <div>
    <div v-if="disabledViaDefinition === undefined">disabledViaDefinition: Not available (expected)</div>
    <div v-else>disabledViaDefinition: {{ disabledViaDefinition }}</div>
    
    <div v-if="disabledViaConfig === undefined">disabledViaConfig: Not available (expected)</div>
    <div v-else>disabledViaConfig: {{ disabledViaConfig }}</div>
  </div>
</template>

<script setup lang="ts">
const { $disabledViaDefinition, $disabledViaConfig } = useNuxtApp()
const disabledViaDefinition = $disabledViaDefinition
const disabledViaConfig = $disabledViaConfig
</script>
