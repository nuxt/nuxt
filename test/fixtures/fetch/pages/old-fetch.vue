<template>
  <div id="old-fetch">
    oldFetchData: {{ $store.state.oldFetchData }}
  </div>
</template>

<script>
export default {
  fetch ({ store, route }) {
    store.commit('setOldFetchData', route.name)
  },
  data () {
    return {
      team: []
    }
  }
}
</script>
