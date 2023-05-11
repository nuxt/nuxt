import '~/assets/plugin.css'

export class OnMountedMethod {
  public onMounted () {
    console.log('public onMounted')
  }

  onBeforeMount () {
    console.log('onBeforeMount')
  }
}
export default defineNuxtPlugin(() => {
  //
})
