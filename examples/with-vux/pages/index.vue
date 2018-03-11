<template>
  <div>
    <group title="vux demo">
      <cell title="cell" value="click me" is-link @click.native="alert"></cell>
    </group>
  </div>
</template>


<script>
export default {
  head() {
    return {
      title: 'vux demo'
    }
  },
  methods: {
    alert() {
      this.$vux.alert.show('This is a Alert example.')
    }
  }
}
</script>