/**
 * Whether an internal link records its path while a page is prerendered.
 *
 * `crawlLinks` is the user's `prerender.crawlLinks`. When it is unset, follow `crawlByDefault`:
 * the vite server builder crawls unless told not to, and Nitro does not.
 */
export function hintPrerenderedLinksEnabled (crawlLinks: boolean | undefined, crawlByDefault: boolean): boolean {
  return (crawlLinks ?? crawlByDefault) === true
}
