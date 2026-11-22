<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{ products: { sku: string, name: string }[] }>()

useAgentTool(defineAgentTool({
  name: 'search_products',
  description: 'Find products by name. Use when the user asks what is for sale.',
  input: z.object({ query: z.string() }),
  annotations: { readOnlyHint: true },
  execute: ({ query }) => props.products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).map(p => p.sku),
}))
</script>

<template>
  <div />
</template>
