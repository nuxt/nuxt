export function useLifecycleLogs (name: string) {
  onMounted(() => console.log(`${name}: onMounted`))
  onUnmounted(() => console.log(`${name}: onUnmounted`))
  onActivated(() => console.log(`${name}: onActivated`))
  onDeactivated(() => console.log(`${name}: onDeactivated`))
}
