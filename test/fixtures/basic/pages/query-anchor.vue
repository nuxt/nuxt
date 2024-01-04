<template>
    <div>
        <NuxtLoadingIndicator id="indicator" :throttle="0"  />
        <a href="#a" id="query-anchor">Query anchor</a>
        <div id="a">anchor #a</div>
        <button id="increase-query" @click="increaseQuery">
            increase query count
        </button>
    </div>
</template>

<script setup lang="ts">
const count = ref(0)

function increaseQuery() {
    count.value++
    navigateTo('/query-anchor?count=' + count.value)
}
</script>