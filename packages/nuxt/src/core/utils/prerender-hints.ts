/**
 * Whether an internal link records its path while a page is prerendered.
 *
 * Pass `crawlLinks` from the user's config. Unset means yes. `false` means no. Nitro's own
 * default is `false`. Reading that default would turn the hints off when the user left the
 * option unset.
 */
export function hintPrerenderedLinksEnabled (crawlLinks: boolean | undefined): boolean {
  return crawlLinks !== false
}
