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
</script>

<template>
  <div>
    {{ value }}-{{ data }}
  </div>
</template>

<style scoped>

</style>
