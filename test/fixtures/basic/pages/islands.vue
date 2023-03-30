<script setup lang="ts">
const islandProps = ref({
  bool: true,
  number: 100,
  str: 'helo world',
  obj: { json: 'works' }
})

const routeIslandVisible = ref(false)
const testCount = ref(0)
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
    <AsyncServerComponent :count="count" >
    
      <div>WONDERFUl TEST SLOT .server</div></AsyncServerComponent>
    <div>
      Async component (1000ms):
      <div>
        <NuxtIsland name="LongAsyncComponent" :props="{ count }">
          <div>SLOT TESTING THIS IS A NICE DEFAULT SLOT </div>
          <SugarCounter :multiplier="testCount" />
          <template #test>
            <div>WONDERFUl TEST SLOT</div>
          </template>
        </NuxtIsland>
        <button @click="count++">
          add +1 to count
        </button>
      </div>
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
