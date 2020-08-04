import consola from 'consola'
import { DeterminedGlobals, timeout } from 'src/utils'

interface Options {
  globals: DeterminedGlobals
  loadedCallback: string
  loadingTimeout?: number
}

export default async function renderAndGetWindow (
  url = 'http://localhost:3000',
  jsdomOpts = {},
  {
    loadedCallback,
    loadingTimeout = 2000,
    globals
  }: Options
) {
  const jsdom = await import('jsdom')
    .then(m => m.default || m)
    .catch((e) => {
      consola.error(`
         jsdom is not installed. Please install jsdom with:
          $ yarn add --dev jsdom
          OR
          $ npm install --dev jsdom
        `)
      throw e
    })

  const options = Object.assign({
    // Load subresources (https://github.com/tmpvar/jsdom#loading-subresources)
    resources: 'usable',
    runScripts: 'dangerously',
    virtualConsole: true,
    beforeParse (window: Window) {
      // Mock window.scrollTo
      window.scrollTo = () => {}
    }
  }, jsdomOpts)

  const jsdomErrHandler = (err: any) => {
    throw err
  }

  if (options.virtualConsole) {
    if (options.virtualConsole === true) {
      options.virtualConsole = new jsdom.VirtualConsole().sendTo(consola)
    }
    // Throw error when window creation failed
    options.virtualConsole.on('jsdomError', jsdomErrHandler)
  }

  const { window } = await jsdom.JSDOM.fromURL(url, options)

  // If Nuxt could not be loaded (error from the server-side)
  const nuxtExists = window.document.body.innerHTML.includes(`id="${globals.id}"`)

  if (!nuxtExists) {
    const error = new Error('Could not load the nuxt app')
    error.body = window.document.body.innerHTML
    window.close()
    throw error
  }

  // Used by Nuxt.js to say when the components are loaded and the app ready
  await timeout(new Promise((resolve) => {
    window[loadedCallback] = () => resolve(window)
  }), loadingTimeout, `Components loading in renderAndGetWindow was not completed in ${loadingTimeout / 1000}s`)

  if (options.virtualConsole) {
    // After window initialized successfully
    options.virtualConsole.removeListener('jsdomError', jsdomErrHandler)
  }

  // Send back window object
  return window
}
