import type { JSONSchema } from './registry'

type FieldControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

/** A form value the tool can read and write, keyed by its path in the tool input (`email`, `address.city`). */
export interface FormField {
  /** The `v-model` expression; matches the `data-agent-field` attribute on the bound element. */
  source: string
  get: () => unknown
  set: (value: unknown) => void
}

export type FormFields = Record<string, FormField>

const CONTROLS = 'button, [role="button"], input, select, textarea'
const INPUTS = 'input, select, textarea'

function collapse (value: string) {
  const collapsed = value.replace(/\s+/g, ' ').trim()
  return collapsed.length > 160 ? `${collapsed.slice(0, 157)}...` : collapsed
}

function textOf (el: Element, skip?: string) {
  const parts: string[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const control = skip && walker.currentNode.parentElement?.closest(skip)
    if (!control || !el.contains(control)) {
      parts.push(walker.currentNode.textContent || '')
    }
  }
  return collapse(parts.join(' '))
}

export function labelOf (el: Element) {
  return el.getAttribute('aria-label') || textOf(el)
}

/** The text of the `v-for` item containing `el`, without the text of its controls. */
export function itemLabel (el: Element) {
  const item = el.closest('[data-agent-item]') ?? el
  return textOf(item, CONTROLS) || labelOf(item)
}

export const isDisabled = (el: Element) => el.matches(':disabled') || !!el.closest('[aria-disabled="true"]')

export function formOf (el: Element) {
  return el instanceof HTMLFormElement ? el : el.querySelector('form') ?? el.closest('form')
}

/** The first submit button of `form` the user can activate, or its first submit button when none can be. */
export function submitterOf (form: Element) {
  const submitters = [...form.querySelectorAll<HTMLElement>('[type="submit"], button:not([type])')]
  return submitters.find(submitter => !isDisabled(submitter)) ?? submitters[0] ?? null
}

function markersOf (form: Element, field: FormField) {
  return [...form.querySelectorAll('[data-agent-field]')].filter(m => m.getAttribute('data-agent-field') === field.source)
}

function controlsOf (markers: Element[]) {
  return markers
    .map(m => (m.matches(INPUTS) ? m : m.querySelector(INPUTS)) as FieldControl | null)
    .filter((c): c is FieldControl => !!c)
}

function describe (markers: Element[], controls: FieldControl[]) {
  const control = controls[0]
  const label = control?.labels?.[0]
  const attr = (name: string) => control?.getAttribute(name) || markers[0]?.getAttribute(name)
  return attr('toolparamdescription')
    || (label && textOf(label, INPUTS))
    || attr('aria-label')
    || attr('aria-labelledby')?.split(/\s+/).map(id => document.getElementById(id)).map(el => el && textOf(el, INPUTS)).find(Boolean)
    || attr('aria-description')
    || (markers[0] && [...markers[0].querySelectorAll('label, legend')].map(l => textOf(l, INPUTS)).find(Boolean))
    || control?.getAttribute('placeholder')
    || undefined
}

function valueSchema (value: unknown): JSONSchema {
  switch (typeof value) {
    case 'boolean':
    case 'number':
    case 'string':
      return { type: typeof value }
  }
  return Array.isArray(value) ? { type: 'array' } : {}
}

/** A schema for one of `choices`, with the value `v-model` writes for each: its bound number or boolean, or its string value. */
function choiceSchema (choices: (HTMLOptionElement | HTMLInputElement)[], title: (choice: HTMLOptionElement | HTMLInputElement) => string): JSONSchema {
  const oneOf = choices.map((choice) => {
    const bound = (choice as { _value?: unknown })._value
    return { const: typeof bound === 'number' || typeof bound === 'boolean' ? bound : choice.value, title: title(choice) }
  })
  const types = new Set(oneOf.map(option => typeof option.const))
  return { ...types.size > 1 ? {} : { type: [...types][0] ?? 'string' }, oneOf }
}

function controlSchema (controls: FieldControl[], value: unknown): JSONSchema | undefined {
  const [control] = controls
  if (control instanceof HTMLSelectElement) {
    const option = choiceSchema([...control.options].filter(o => o.value), labelOf)
    return control.multiple ? { type: 'array', items: option } : option
  }
  if (!(control instanceof HTMLInputElement)) {
    return control && { type: 'string' }
  }
  const choice = () => choiceSchema(controls as HTMLInputElement[], c => describe([], [c as HTMLInputElement]) ?? c.value)
  switch (control.type) {
    case 'radio':
      return choice()
    case 'checkbox':
      return Array.isArray(value) ? { type: 'array', items: choice() } : { type: 'boolean' }
    case 'number':
    case 'range':
      return {
        type: 'number',
        ...control.min ? { minimum: Number(control.min) } : {},
        ...control.max ? { maximum: Number(control.max) } : {},
      }
    case 'email':
    case 'url':
    case 'date':
      return { type: 'string', format: control.type === 'url' ? 'uri' : control.type }
  }
  return { type: 'string' }
}

function propertyAt (schema: JSONSchema, path: string[], create: boolean): { parent: JSONSchema, name: string } | undefined {
  let node = schema
  for (const segment of path.slice(0, -1)) {
    const properties = (node.properties ??= {}) as Record<string, JSONSchema>
    if (!properties[segment]) {
      if (!create) {
        return
      }
      properties[segment] = { type: 'object', properties: {} }
    }
    node = properties[segment]
  }
  node.properties ??= {}
  return { parent: node, name: path.at(-1)! }
}

/** JSON Schema for a form without a Standard Schema: types from the current values, refined by native controls. */
export function formSchema (fields: FormFields, form: Element): JSONSchema {
  const schema: JSONSchema = { type: 'object', properties: {} }
  for (const [key, field] of Object.entries(fields)) {
    const markers = markersOf(form, field)
    const controls = controlsOf(markers)
    const { parent, name } = propertyAt(schema, key.split('.'), true)!
    ;(parent.properties as Record<string, JSONSchema>)[name] = controlSchema(controls, field.get()) ?? valueSchema(field.get())
    if (controls.some(c => c.required)) {
      parent.required = [...(parent.required as string[] | undefined) ?? [], name]
    }
  }
  return describeSchema(schema, fields, form)
}

const SENSITIVE_AUTOCOMPLETE_RE = /(?:^|\s)(?:current-password|new-password|one-time-code|cc-\S+)(?:\s|$)/i

/** Whether the value of `control` is a secret, which must not reach an agent as part of a schema. */
function isSensitive (control: FieldControl) {
  return (control instanceof HTMLInputElement && (control.type === 'password' || control.type === 'hidden'))
    || SENSITIVE_AUTOCOMPLETE_RE.test(control.getAttribute('autocomplete') || control.closest('[data-agent-field]')?.getAttribute('autocomplete') || '')
}

/**
 * Fills gaps in a form's schema from the page: descriptions from labels, and the current values
 * as defaults, except for passwords, payment card details, hidden fields and `writeOnly` properties.
 * Fields with a value are not required, because input is merged into the form's state.
 */
export function describeSchema (schema: JSONSchema, fields: FormFields, form: Element) {
  for (const [key, field] of Object.entries(fields)) {
    const at = propertyAt(schema, key.split('.'), false)
    const property = at && (at.parent.properties as Record<string, JSONSchema>)[at.name]
    if (!at || !property) {
      continue
    }
    const markers = markersOf(form, field)
    const controls = controlsOf(markers)
    if (!property.description) {
      const description = describe(markers, controls)
      if (description) {
        property.description = description
      }
    }
    const value = field.get()
    if (value !== undefined && value !== null && value !== '' && property.default === undefined) {
      if (property.writeOnly !== true && !controls.some(isSensitive)) {
        property.default = value
      }
      at.parent.required = (at.parent.required as string[] | undefined)?.filter(name => name !== at.name)
    }
  }
  return schema
}

/** `base` with `input` merged in, without modifying either. */
export function mergeInput (base: unknown, input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !base || typeof base !== 'object' || Array.isArray(base)) {
    return input === undefined ? base : input
  }
  const merged: Record<string, unknown> = { ...base as Record<string, unknown> }
  for (const [key, value] of Object.entries(input)) {
    merged[key] = mergeInput(merged[key], value)
  }
  return merged
}

function getIn (value: unknown, path: string[]) {
  return path.reduce<unknown>((node, segment) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined), value)
}

function coerce (value: unknown, current: unknown) {
  if (typeof current === 'number' && typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  if (typeof current === 'boolean' && (value === 'true' || value === 'false')) {
    return value === 'true'
  }
  return value
}

/** Writes input values through the form's `v-model` targets; returns problems with the input. */
export function fillFields (fields: FormFields, input: Record<string, unknown>) {
  const problems: string[] = []
  const keys = Object.keys(fields)
  for (const name of Object.keys(input)) {
    if (!keys.some(key => key === name || key.startsWith(`${name}.`))) {
      problems.push(`${name}: not a field of this form`)
    }
  }
  if (problems.length) {
    return problems
  }
  for (const [key, field] of Object.entries(fields)) {
    const value = getIn(input, key.split('.'))
    if (value !== undefined) {
      field.set(coerce(value, field.get()))
    }
  }
  return problems
}

function isLocked (control: FieldControl) {
  return isDisabled(control)
    || ('readOnly' in control && control.readOnly)
    || (control instanceof HTMLInputElement && control.type === 'hidden')
    || !!control.closest('[aria-readonly="true"]')
}

/** Problems with input that changes a field whose controls are disabled, read-only or hidden. */
export function lockedProblems (fields: FormFields, form: Element, input: Record<string, unknown>) {
  const problems: string[] = []
  for (const [key, field] of Object.entries(fields)) {
    const value = getIn(input, key.split('.'))
    const controls = controlsOf(markersOf(form, field))
    if (value !== undefined && controls.length && controls.every(isLocked) && JSON.stringify(coerce(value, field.get())) !== JSON.stringify(field.get())) {
      problems.push(`${key}: this field cannot be changed`)
    }
  }
  return problems
}

/** The form's values, shaped like the tool input. */
export function readFields (fields: FormFields) {
  const value: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(fields)) {
    const path = key.split('.')
    let node = value
    for (const segment of path.slice(0, -1)) {
      node = (node[segment] ??= {}) as Record<string, unknown>
    }
    node[path.at(-1)!] = field.get()
  }
  return value
}

/** Constraint validation messages from native controls bound to the form's fields. */
export function nativeProblems (fields: FormFields, form: Element) {
  const problems: string[] = []
  for (const [key, field] of Object.entries(fields)) {
    const invalid = controlsOf(markersOf(form, field)).find(c => !c.checkValidity())
    if (invalid) {
      problems.push(`${key}: ${invalid.validationMessage}`)
    }
  }
  return problems
}

let active: (() => void) | undefined

/**
 * Marks elements with `data-agent-active` and an outline, and scrolls the first into view.
 * The marks are cleared when the user clicks one of the elements, or when other elements are highlighted.
 */
export function highlight (elements: Element[]) {
  active?.()
  const styled = elements.filter((el): el is HTMLElement => el instanceof HTMLElement)
  const previous = styled.map(el => [el.style.outline, el.style.outlineOffset] as const)
  const clear = () => {
    elements.forEach((el) => {
      el.removeAttribute('data-agent-active')
      el.removeEventListener('click', clear)
    })
    styled.forEach((el, i) => {
      el.style.outline = previous[i]![0]
      el.style.outlineOffset = previous[i]![1]
    })
    active = undefined
  }
  elements.forEach((el) => {
    el.setAttribute('data-agent-active', '')
    el.addEventListener('click', clear)
  })
  styled.forEach((el) => {
    el.style.outline = '3px solid #00dc82'
    el.style.outlineOffset = '3px'
  })
  active = clear
  elements[0]?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
}
