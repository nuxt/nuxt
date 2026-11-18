<script setup lang="ts">
function something (_method: () => unknown) {
  return () => 'decorated'
}

class SomeClass {
  @something
  public someMethod () {
    return 'initial'
  }
}

const value = new SomeClass().someMethod()

const { data } = await useFetch('/api/experimental/decorators')
const { data: tsxData } = await useFetch('/api/experimental/decorators-tsx')
</script>

<template>
  <div>
    {{ value }}-{{ data }}-<DecoratedTsx />-{{ tsxData }}
  </div>
</template>

<style scoped>

</style>
