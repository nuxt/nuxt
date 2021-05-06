import type { Plugin } from '@nuxt/app'

export default <Plugin> function progressbar ({ app }) {
  const { $nuxt } = app
  $nuxt.hook('app:mounted', () => {
    const el = document.createElement('div')
    el.id = 'nuxt-progress'
    document.body.appendChild(el)
    el.style.position = 'fixed'
    el.style.backgroundColor = 'black'
    el.style.height = '2px'
    el.style.top = '0px'
    el.style.left = '0px'
    el.style.transition = 'width 0.1s, opacity 0.4s'
    const duration = 3000
    const progress = 10000 / Math.floor(duration)
    let timeout
    let interval
    $nuxt.hook('page:start', () => {
      if (timeout) { return }
      timeout = setTimeout(() => {
        let width = 10
        el.style.opacity = '100%'
        el.style.width = '10%'
        interval = setInterval(() => {
          if (width >= 100) { return }
          width = Math.floor(width + progress)
          el.style.width = `${width}%`
        }, 100)
      }, 200)
    })
    $nuxt.hook('page:finish', () => {
      timeout && clearTimeout(timeout)
      timeout = null
      interval && clearInterval(interval)
      interval = null
      el.style.width = '100%'
      el.style.opacity = '0%'
      setTimeout(() => {
        el.style.width = '0%'
      }, 500)
    })
  })
}
