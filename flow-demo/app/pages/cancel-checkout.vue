<script setup lang="ts">
const orderNumber = ref('ORD-2024-1583')

function cancelOrder() {
  abortNavigation()
}
</script>

<template>
  <div>
    <NuxtLink to="/">← Back</NuxtLink>
    <h1>Cancel Order</h1>
    <p>Are you sure you want to cancel order <strong>{{ orderNumber }}</strong>?</p>
    <p>This action cannot be undone.</p>
    <div>
      <button @click="cancelOrder">Yes, cancel my order</button>
      <NuxtLink to="/">No, keep my order</NuxtLink>
    </div>
  </div>
</template>
