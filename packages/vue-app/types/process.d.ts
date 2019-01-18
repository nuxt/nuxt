/**
 * Extends NodeJS.Process interface
 */

declare namespace NodeJS {
  interface Process {
    browser: boolean;
    client: boolean;
    mode: 'universal' | 'spa';
    modern: boolean;
    server: boolean;
    static: boolean;
  }
}
