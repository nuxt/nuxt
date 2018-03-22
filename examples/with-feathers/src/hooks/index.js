// Add any common hooks you want to share across services in here.
//
// Below is an example of how a hook is written and exported. Please
// see http://docs.feathersjs.com/hooks/readme.html for more details
// on hooks.

export function myHook(options) {
  return function (hook) {
    console.log('My custom global hook ran. Feathers is awesome!') // eslint-disable-line no-console
  }
}
