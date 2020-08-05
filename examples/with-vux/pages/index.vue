<template>
  <div>
    <group title="vux demo">
      <cell title="cell" value="click me" is-link @click.native="alert" />
    </group>
  </div>
</template>

<script>
export default {
  methods: {
    alert () {
      this.$vux.alert.show('This is a Alert example.')
    }
  },
  head () {
    return {
      title: 'vux demo'
    }
  }
}
</script>
