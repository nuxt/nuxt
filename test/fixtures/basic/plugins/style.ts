import '~/assets/plugin.css'

export class OnMountedMethod {
  public onMounted () {
    // eslint-disable-next-line no-console
    process.client && console.log('public onMounted')
  }

  onBeforeMount () {
    // eslint-disable-next-line no-console
    process.client && console.log('onBeforeMount')
  }
}
export default defineNuxtPlugin(() => {
  //
})
