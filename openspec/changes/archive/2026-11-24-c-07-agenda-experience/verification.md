# Verification — C-07 agenda-experience

## Decisions and approvals
- P2-02 resolved: maximum 31 calendar days inclusive, no temporal pagination.
- Query contract, UI states, files, risks and test plan approved by Gonzalo before Apply.
- Design system: `Decision: no (project policy)`; no mockups, no Playwright.

## Executed in the VM
| Check | Result |
|---|---|
| Backend unit tests (agenda: range, DTO, service, controller) | 64 passing |
| `architecture-boundaries.spec.ts` | passing |
| Backend `tsc --noEmit -p tsconfig.build.json` | clean |
| Frontend `tsc -p tsconfig.app.json --noEmit` (TypeScript 6.0.3 from backend) | clean |
| `node scripts/change-scope/check.mjs --branch change/c-07-agenda-experience --base main` | passed |
| `openspec validate c-07-agenda-experience --strict` | valid |

## Executed by Gonzalo on Windows (real MariaDB 13.0, output reviewed)
| Check | Result |
|---|---|
| `backend`: `npm run test:integration` (TZ America/Argentina/Buenos_Aires) | `agenda.integration-spec.ts`: 22/22 passing; the 7 suites ran against real MariaDB |
| `backend`: `npm test` | 30 suites, 348 tests passing |
| `backend`: `npm run lint` | 0 warnings, 0 errors (141 files) |
| `backend`: `npm run build` (`nest build`) | finished without errors |
| `frontend`: `npm test` | 20 files, 111 tests passing (includes `agenda.test.tsx`, params, status, errors, time) |
| `frontend`: `npm run lint` | 0 warnings, 0 errors (90 files) |
| `frontend`: `npx tsc -b` / `npm run build` | no errors; vite build OK |
| Manual visual review at 390×844 and 1440×900 (empty state, date navigation, filters, refresh) | OK; title capitalization fixed |

## Final manual visual confirmation

- **Date:** 2026-11-24 (`America/Argentina/Buenos_Aires`).
- **Confirmation:** Pablo explicitly confirmed: "C-07 revisado en ambos tamaños, sin diferencias".
- **Coverage closed:** populated agenda states, badges, appointment detail, `Esc` close/focus return, blocking and exception indicators, focus and overflow at **390x844** and **1440x900**.
- **Result:** no visual differences reported. No Playwright or automated screenshots were used.

## Notes
- Local finding for Pablo: the backend does not load `backend/.env` on startup (only the integration runner does); the dev DB also needs `npm run migration:run`.
- 77 line-ending-modified files left untouched by instruction.
- C-06 integration is only a proposed contract (`renderActions`); see `coordination.md`.
