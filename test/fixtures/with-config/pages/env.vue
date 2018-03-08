<template>
  <div>
    <span id="fromContext">{{ env }}</span>
    <span id="fromProcess">{{ processEnv }}</span>
    <span id="forDynamicCall">{{ string }}</span>
    <span id="forNestedObject">{{ nestedObject }}</span>
  </div>
</template>

<script>
export default {
  layout: 'custom-env',
  data() {
    const string = 'string'
    return {
      processEnv: JSON.stringify(process.env),
      string: JSON.stringify([process.env.string, process.env['string'], process.env[string]]),
      nestedObject: process.env.object.obj.again
    }
  },
  asyncData({ env }) {
    return { env: JSON.stringify(env) }
  }
}
</script>
