/** Declaraciones mínimas para el test de tokens; `tsconfig.app.json` solo incluye `vite/client`. */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string
}

declare module 'node:path' {
  export function resolve(...parts: string[]): string
}

declare const process: { cwd(): string }
