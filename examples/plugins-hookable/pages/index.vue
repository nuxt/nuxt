<template>
  <div>
    <h1>Hookable plugins</h1>

    <h3>Plugin load order</h3>
    <p v-for="(plugin, idx) in $loadOrder" :key="`load-${idx}`">
      {{ plugin }}
    </p>

    <h3>Inject hook order</h3>
    <p v-for="(plugin, idx) in $hookOrder" :key="`hook-${idx}`">
      {{ plugin }}
    </p>
  </div>
</template>

<script>
</script>
