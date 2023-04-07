<script setup lang="ts">
const islandProps = ref({
  bool: true,
  number: 100,
  str: 'helo world',
  obj: { json: 'works' }
})

const routeIslandVisible = ref(false)

const count = ref(0)
</script>

<template>
  <div>
    Pure island component:
    <div class="box">
      <NuxtIsland name="PureComponent" :props="islandProps" />
      <NuxtIsland name="PureComponent" :props="islandProps" />
    </div>
    <button @click="islandProps.number++">
      Increase
    </button>
    <hr>
    Route island component:
    <div v-if="routeIslandVisible" class="box">
      <NuxtIsland name="RouteComponent" :context="{ url: '/test' }" />
    </div>
    <button v-else @click="routeIslandVisible = true">
      Show
    </button>

    <p>async .server component</p>
    <AsyncServerComponent :count="count" />
    <div>
      Async island component (20ms):
      <NuxtIsland name="LongAsyncComponent" :props="{ count }" />
      <button @click="count++">
        add +1 to count
      </button>
    </div>
  </div>
</template>

<style scoped>
.box {
  border: 1px solid black;
  margin: 3px;
  display: flex;
}
</style>
