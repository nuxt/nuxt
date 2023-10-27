<script setup lang="ts">
import { useSharedAsyncData } from '../../composables/asyncDataTests'
import ComponentWithSharedUseAsyncData from '../../components/ComponentWithSharedUseAsyncData.vue'

const { data, pending, execute } = useSharedAsyncData()
const router = useRouter()

const page = ref(1)
const changeQuery = () => {
  page.value += 1
  router.push({
    query: {
      page: page.value
    }
  })
}
</script>

<template>
  <div>
    <div id="pageWithSharedAsyncData__execute" @click="() => execute()">
      execute
    </div>
    <div id="pageWithSharedAsyncData__changeQuery" @click="changeQuery">
      changeQuery
    </div>

    <div id="pageWithSharedAsyncData__data">
      {{ data }}
    </div>
    <div id="pageWithSharedAsyncData__pending">
      {{ pending }}
    </div>

    <ComponentWithSharedUseAsyncData />
  </div>
</template>
