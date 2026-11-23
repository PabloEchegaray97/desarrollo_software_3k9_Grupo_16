# Cómo trabajar en un change

Esta guía permite comenzar y entregar un change sin conocer previamente el repositorio. `CHANGES.md` es la fuente canónica de responsables, dependencias y ownership. El guard valida paths; no crea, aprueba ni fusiona pull requests.

## 1. Identificarse y elegir el change

El primer mensaje de cada integrante debe decir:

```text
Soy <integrante> y trabajaré C-XX <slug>.
```

Confirmar que las dependencias estén integradas en `main` y usar exactamente una de estas ramas:

| Change | Responsable | Rama |
|---|---|---|
| C-01 | Pablo | `change/c-01-foundation-and-contracts` |
| C-02 | Paula | `change/c-02-patients-and-catalogs` |
| C-03 | Milagros | `change/c-03-availability-and-schedule-settings` |
| C-04 | Gonzalo | `change/c-04-authentication-and-app-shell` |
| C-05 | Paula | `change/c-05-appointment-creation-engine` |
| C-06 | Milagros | `change/c-06-appointment-lifecycle-history` |
| C-07 | Gonzalo | `change/c-07-agenda-experience` |
| C-08 | Pablo | `change/c-08-integration-ui-polish` |

## 2. Preparar la rama

Con un árbol limpio y para una rama nueva:

```powershell
git status --short --branch
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c change/c-XX-slug-exacto
git branch --show-current
```

Si la rama ya existe localmente, usar `git switch change/c-XX-slug-exacto`. Si existe solo en remoto, usar `git switch --track origin/change/c-XX-slug-exacto`.

Si aparece trabajo local, falla el fast-forward o la rama tiene un estado inesperado, detenerse y avisar. No usar `stash`, no borrar archivos y no forzar el cambio de rama.

## 3. Acordar e implementar

1. Leer la ficha de C-XX en `CHANGES.md` y sus documentos “Leer antes”.
2. Confirmar los directorios propios y compartidos.
3. Ejecutar `$active-delivery`, elegir SDD y crear una propuesta con `$openspec-propose`.
4. Esperar aprobación humana de proposal, specs, design y tasks.
5. Aplicar con `$openspec-apply-change` y marcar tareas solo después de verificarlas.
6. No ejecutar `openspec init`, `openspec-sync-specs` ni `openspec-archive-change` desde una rama de contributor.

Cada propuesta activa usa un directorio exclusivo: `openspec/changes/c-XX-slug-exacto/`. Las migraciones son add-only y su nombre debe incluir `CXX`.

## 4. Verificar antes de entregar

Ejecutar las suites relevantes desde cada proyecto:

```powershell
cd backend
npm run build
npm test
npm run test:e2e
npm run test:integration

cd ..\frontend
npm run build
npm test

cd ..
node scripts/change-scope/check.mjs --branch change/c-XX-slug-exacto --base main
git status --short
git diff --stat main...HEAD
```

La integración debe usar MariaDB real mediante `TEST_DATABASE_*`. No se acepta SQLite ni una base en memoria.

## 5. Commit, push y pull request

El agente no hace commit, push ni merge sin una instrucción humana explícita. Cuando el responsable lo autorice:

```powershell
git add <archivos-revisados>
git commit -m "feat(C-XX): resumen breve"
git push -u origin change/c-XX-slug-exacto
```

En GitHub, abrir **Pull requests → New pull request**, seleccionar base `main` y compare `change/c-XX-slug-exacto`. Usar título `[C-XX] slug-exacto` e incluir:

- resumen y límites;
- archivos/directorios modificados;
- pruebas ejecutadas y resultado;
- verificación manual pendiente o realizada;
- decisiones o riesgos que Pablo deba revisar.

Quien ya tenga GitHub CLI autenticado puede usar, opcionalmente:

```powershell
gh pr create --base main --head change/c-XX-slug-exacto --title "[C-XX] slug-exacto" --fill
```

El check **Change scope** compara el PR con su base. Un error `outside ownership` indica que se tocó un path ajeno; `protected project surface` indica una superficie reservada; `migrations are add-only` o `migration name must include CXX` exige corregir la migración. No se amplía el scope para hacer pasar el check: se informa a Pablo.

Pablo revisa diff, evidencia y checks; él decide la integración en `main` y luego sincroniza/archiva OpenSpec.
