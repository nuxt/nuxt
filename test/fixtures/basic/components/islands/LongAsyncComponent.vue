<template>
  <div>
    {{ data }}
    <div id="long-async-component-count">
      {{ count }}
    </div>
    {{ headers['custom-head'] }}
    <p>hello world !!!</p>
  </div>
</template>

<script setup lang="ts">
import { getResponseHeaders } from 'h3'
defineProps<{
  count: number
}>()

const evt = useRequestEvent()
const headers = getResponseHeaders(evt)
const { data } = await useFetch('/api/very-long-request')
</script>
