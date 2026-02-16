load("@aspect_rules_js//js:defs.bzl", "js_library", "js_test")

package(default_visibility = ["//visibility:public"])

js_library(
    name = "migration_20260216_initial_schema",
    srcs = ["20260216_initial_schema.js"],
    visibility = ["//visibility:public"],
)

js_library(
    name = "all_migrations",
    srcs = [
        ":migration_20260216_initial_schema",
    ],
    visibility = ["//visibility:public"],
)

js_library(
    name = "migration_tests",
    srcs = ["migrations.test.js"],
    deps = [
        ":migration_20260216_initial_schema",
    ],
)

js_test(
    name = "migration_tests_js_test",
    data = [":migration_tests"],
    entry_point = ":migration_tests",
)

js_library(
    name = "migration_integration_tests",
    srcs = ["migrations.integration.test.js"],
    deps = [
        ":migration_20260216_initial_schema",
        "//libs/db:node_modules/knex",
        "//libs/db:node_modules/mysql2",
    ],
)

js_test(
    name = "migration_integration_js_test",
    data = select({
        "//conditions:default": [
            ":migration_integration_tests",
        ],
        "//libs/db:include_env": [
            ":migration_integration_tests",
            "//:_env",
        ],
    }),
    entry_point = ":migration_integration_tests",
)
