<template>
  <div>{{ test.attributes.message }}</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

interface Test {
  attributes: {
    message: string
  }
}

@Component({
  name: 'Interface'
})
export default class extends Vue {
  test: Test = {
    attributes: {
      message: 'Interface Page'
    }
  }
}
</script>
