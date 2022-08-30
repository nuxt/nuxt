<template>
  <div>
    Single
    <div>
      {{ data }} - {{ data2 }}
    </div>
  </div>
</template>

<script setup lang="ts">
const { data, refresh } = await useCounter()
const { data: data2, refresh: refresh2 } = await useCounter()

let inital = data.value.count

// Refresh on client and server side
await refresh()

if (data.value.count !== inital + 1) {
  throw new Error('Data not refreshed?' + data.value.count + ' : ' + data2.value.count)
}

if (data.value.count !== data2.value.count) {
  throw new Error('AsyncData not synchronised')
}

inital = data.value.count

await refresh2()

if (data.value.count !== inital + 1) {
  throw new Error('data2 refresh not syncronised?')
}

if (data.value.count !== data2.value.count) {
  throw new Error('AsyncData not synchronised')
}

</script>
