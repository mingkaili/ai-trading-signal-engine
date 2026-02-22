load("@aspect_rules_js//js:defs.bzl", "js_binary", "js_library")
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")
load("@npm//:defs.bzl", "npm_link_all_packages")

package(default_visibility = ["//visibility:public"])

exports_files([
    ".env",
    ".envsample",
    "package.json",
])

npm_link_all_packages(name = "node_modules")

config_setting(
    name = "include_env",
    define_values = {
        "include_env": "true",
    },
)

filegroup(
    name = "knex_ts",
    srcs = ["knex.ts"],
)

filegroup(
    name = "knexfile_ts",
    srcs = ["knexfile.ts"],
)

ts_project(
    name = "knex_ts_project",
    srcs = ["knex.ts"],
    out_dir = "dist",
    tsconfig = ":tsconfig.json",
    resolve_json_module = True,
    validate = False,
    deps = [
        ":node_modules/knex",
        ":node_modules/mysql2",
    ],
)

js_library(
    name = "knexfile_js",
    srcs = ["knexfile.js"],
    deps = [
        ":node_modules/dotenv",
    ],
)

js_library(
    name = "knex_migrate_js",
    srcs = ["knex_migrate.js"],
    deps = [
        ":knexfile_js",
        ":node_modules/knex",
        ":node_modules/dotenv",
    ],
)

# Service-local env for migration and db tooling.
js_library(
    name = "_env",
    srcs = [".env"],
    visibility = [
        "//libs/db:__pkg__",
        "//libs/db/migrations:__pkg__",
    ],
)

# bazel --output_user_root=/Users/mingkaili/Desktop/ai-trading-signal-engine/.bazel_user_root run //libs/db:knex_migrate --define include_env=true
js_binary(
    name = "knex_migrate",
    data = select({
        "//conditions:default": [
            ":knex_migrate_js",
        ],
        ":include_env": [
            ":knex_migrate_js",
            ":_env",
            "//libs/db/migrations:all_migrations",
        ],
    }),
    entry_point = ":knex_migrate_js",
)
