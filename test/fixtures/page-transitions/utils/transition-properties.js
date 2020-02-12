const addEvent = (componentName, callbackName, clear = false) => {
  const ul = document.querySelector('#transition-events')
  if (clear) {
    ul.innerHTML = ''
  }
  const li = document.createElement('li')
  li.textContent = `${componentName}|${callbackName}`
  ul.appendChild(li)
}

export const createTransitionObject = (componentName, transitionName = 'page', child = false) => ({
  name: transitionName,

  beforeEnter () {
    addEvent(componentName, 'beforeEnter', child)
  },
  enter (el, done) {
    addEvent(componentName, 'enter')
    done()
  },
  afterEnter () {
    addEvent(componentName, 'afterEnter')
  },
  beforeLeave () {
    addEvent(componentName, 'beforeLeave', true)
  },
  leave (el, done) {
    addEvent(componentName, 'leave')
    done()
  },
  afterLeave () {
    addEvent(componentName, 'afterLeave')
  }
})
