import { createLargeApp } from './large-app.ts'

export default async function setup (): Promise<void> {
  await createLargeApp()
}
