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
- For `.env` in repo root, create a root `js_library` (e.g. `//:_env`) and add it to `data` instead of referencing `//:.env` directly.

## Knex Migrations
- Use CommonJS for migrations (`.js`) so Knex can load them without a TypeScript runtime.
- Ensure migration files are included in `data` for the migration `js_binary` (via a `js_library` in `libs/db/migrations`).