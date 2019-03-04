/**
 * Extends NodeJS.Process interface
 */

declare namespace NodeJS {
  interface Process {
    browser: boolean
    client: boolean
    mode: 'spa' | 'universal'
    modern: boolean
    server: boolean
    static: boolean
  }
}
