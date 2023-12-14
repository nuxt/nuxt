<template>
  <div>
    <div v-if="count > 2">
      count is above 2
    </div>
    <slot />
    {{ data }}
    <div id="long-async-component-count">
      {{ count }}
    </div>
    {{ headers['custom-head'] }}
    <slot
      name="test"
      :count="count"
    />
    <p>hello world !!!</p>
    <slot
      v-for="(t, index) in 3"
      name="hello"
      :t="t"
    >
      <div :key="t">
        fallback slot -- index: {{ index }}
      </div>
    </slot>

    <slot
      v-for="(t, index) in ['fall', 'back']"
      name="fallback"
      :t="t"
    >
      <div :key="t">
        {{ t }} slot -- index: {{ index }}
      </div>
      <div
        :key="t"
        class="fallback-slot-content"
      >
        wonderful fallback
      </div>
    </slot>
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
