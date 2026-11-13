export function record (entry: string) {
  if (import.meta.client) {
    ;((window as any).__record ??= []).push(entry)
  }
}
