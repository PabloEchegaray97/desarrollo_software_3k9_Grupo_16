import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesPath = resolve(process.cwd(), 'src/features/availability/ui/styles.css')
const tokensPath = resolve(process.cwd(), '../design-system/tokens.css')
const entryPath = resolve(process.cwd(), 'src/features/availability/index.tsx')

describe('5.6 Tokens del sistema visual revisión 1', () => {
  it('usa solo variables aprobadas y no redefine colores ni radios', () => {
    const styles = readFileSync(stylesPath, 'utf8')
    const tokens = readFileSync(tokensPath, 'utf8')
    const used = [...styles.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1])

    expect(used.length).toBeGreaterThan(8)
    for (const name of used) expect(tokens).toContain(`${name}:`)
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(styles).not.toMatch(/rgba?\(/)
    const radii = [...styles.matchAll(/border-radius:\s*([^;]+);/g)].map((match) => match[1].trim())
    expect(radii.length).toBeGreaterThan(3)
    expect(radii.every((value) => value.startsWith('var(--radius-'))).toBe(true)
  })

  it('cubre los estados visuales y se importa desde la entrada de la feature', () => {
    const styles = readFileSync(stylesPath, 'utf8')
    const entry = readFileSync(entryPath, 'utf8')

    for (const fragment of [':hover', ':focus-visible', '[aria-busy=', '[data-state="empty"]', '[data-tone="error"]', ':disabled']) {
      expect(styles).toContain(fragment)
    }
    expect(entry).toContain("import './ui/styles.css'")
  })
})
