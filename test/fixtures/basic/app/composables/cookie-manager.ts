export function useCookieManager () {
  const theCookie = useCookie<null | string>('theCookie', {
    default: () => 'show',
  })

  const showCookieBanner = computed(() => {
    return theCookie.value === 'show'
  })

  function toggle () {
    theCookie.value = theCookie.value === 'show' ? null : 'show'
  }

  return {
    showCookieBanner,
    toggle,
  }
}
