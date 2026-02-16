load("@aspect_rules_js//js:defs.bzl", "js_binary", "js_library")
load("@npm//:defs.bzl", "npm_link_all_packages")

package(default_visibility = ["//visibility:public"])

exports_files([
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

js_binary(
    name = "knex_migrate",
    data = select({
        "//conditions:default": [
            ":knex_migrate_js",
        ],
        ":include_env": [
            ":knex_migrate_js",
            "//:_env",
            "//libs/db/migrations:all_migrations",
        ],
    }),
    entry_point = ":knex_migrate_js",
)
