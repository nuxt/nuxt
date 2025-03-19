import { getCurrentInstance, onActivated, onDeactivated, shallowRef } from 'vue'

/**
 * Activated state in ref.
 */
export function useActivated () {
  const isActivated = shallowRef(false)

  const instance = getCurrentInstance()
  if (instance) {
    onActivated(() => isActivated.value = true, instance)
    onDeactivated(() => isActivated.value = false, instance)
  }

  return isActivated
}
