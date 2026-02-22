# Best Practices

## Bazel Build File Conventions
- Use `BUILD` for build files. Do not create `BUILD.bazel`.
- Do not add `WORKSPACE.bazel`; this repo uses Bzlmod only.
- Do not add `.bazelversion`.
- Create a `BUILD` file in every directory that contains library code.
- Create one Bazel target per code file.
- Use Bazel to run all build and migration commands (no npm scripts).

## Bazel + pnpm + rules_js
- Generate real lockfiles with `npm install` and `pnpm install`; never hand-edit lockfiles.
- `npm_translate_lock` uses `pnpm_lock` and requires `pnpm.onlyBuiltDependencies` in `package.json` (can be empty).
- Add `pnpm-workspace.yaml` and a `package.json` in each workspace package so `npm_link_all_packages` can be used there.
- Call `npm_link_all_packages` in the root `BUILD` and in each workspace package.

## Runfiles & Env Files
- Files used by a `js_binary` must be in the same Bazel package or wrapped by a `js_library` in their own package.
- Each service owns its own `.env` and `.envsample` in its package directory; avoid a monolithic root `.env`.
- For Bazel-run services, load `.env` using an explicit path (e.g. `__dirname/../.env`) instead of relying on the process CWD.

## Knex Migrations
- Use CommonJS for migrations (`.js`) so Knex can load them without a TypeScript runtime.
- Ensure migration files are included in `data` for the migration `js_binary` (via a `js_library` in `libs/db/migrations`).

## TypeScript + Bazel
- If `tsconfig.json` sets `outDir`, the corresponding `ts_project` must set `out_dir` to match.
- Prefer a per-package `tsconfig.json` so `ts_project` does not reference files outside its Bazel package.
- Keep `resolveJsonModule` in sync between `tsconfig.json` and `ts_project` (set `resolve_json_module = True` when needed).

## Service Boundaries
- Keep service-local DB helpers inside the service package to avoid TS module path issues with Bazel.
- When adding a new service, update `pnpm-workspace.yaml` and ensure the service has its own `package.json`.