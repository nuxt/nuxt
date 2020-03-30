<template>
  <h1>{{ $store.state.simpleModule.mutateMe }}</h1>
</template>

<script>
export default {
  middleware ({ store }) {
    store.dispatch('simpleModule/mutate')
  }
}
</script>
