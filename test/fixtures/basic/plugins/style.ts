import '~/assets/plugin.css'

export class OnMountedMethod {
  public onMounted () {
    process.client && console.log('public onMounted')
  }

  onBeforeMount () {
    process.client && console.log('onBeforeMount')
  }
}
export default defineNuxtPlugin(() => {
  //
})
