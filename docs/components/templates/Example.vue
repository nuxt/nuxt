<template>
  <AppPage>
    <PageContent :page="page" />
    <template #prev-next>
      <PagePrevNext :prev="prev" :next="next" />
    </template>
  </AppPage>
</template>

<script>
import {
  defineComponent,
  ref,
  useContext,
  useFetch
} from '@nuxtjs/composition-api'
export default defineComponent({
  props: {
    page: {
      type: Object,
      required: true
    }
  },
  setup (props) {
    const { $docus } = useContext()
    const prev = ref(null)
    const next = ref(null)
    useFetch(async () => {
      const [prevLink, nextLink] = await $docus.getPreviousAndNextLink(
        props.page
      )
      prev.value = prevLink
      next.value = nextLink
    })
    return {
      prev,
      next
    }
  },
  templateOptions: {
    aside: true,
    fluid: false
  }
})
</script>
