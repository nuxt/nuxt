<script setup lang="ts">
import { componentNames } from '#components'
console.log(componentNames)
// @ts-expect-error this is not usable outside a pages directory
definePageMeta({
  // this should be fully tree-shaken out
  title: 'jet common fruit chose bright planning exercise herself position wealth stiff known prepare listen leader eleven found boat dollar eye come author won thought pony biggest feel organized die vast class ask cost ball wrong chicken origin model little properly dangerous dull corner jar mighty solution pilot city locate guide gradually affect curve about snake single silly against fireplace money another involved origin sport where thin stop question go stretch although arrow rush mixture fallen power pay fifteen layers play slightly heavy built needed sing sentence diagram quarter yesterday list faster been having construction curious shoe'
})
</script>

<template>
  <div>Hello World!</div>
</template>
