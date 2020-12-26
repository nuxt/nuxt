<script>
import FooterComponent from '~/components/FooterComponent.vue'
import HeaderComponent from '~/components/HeaderComponent.vue'

const componentMap = {
  footer: FooterComponent,
  header: HeaderComponent
}
export default {
  layout: 'orchestrated',
  render (h) {
    const component = process.server
      ? this.$route.params.component
      : this.$root.$options.orchestrated
    return h(componentMap[component], {
      attrs: {
        'data-orchestrated-app': component
      }
    })
  }
}
</script>
