load("@aspect_rules_js//js:defs.bzl", "js_binary", "js_library", "js_test")
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

ts_project(
    name = "app_ts",
    out_dir = "dist",
    srcs = ["app.ts"],
    tsconfig = ":tsconfig.json",
    resolve_json_module = True,
    deps = [
        ":node_modules/@types/node",
        ":node_modules/@types/express",
        ":node_modules/dotenv",
        ":node_modules/express",
        ":node_modules/knex",
        ":node_modules/mysql2",
    ],
)

js_library(
    name = "_env",
    srcs = [".env"],
)

ts_project(
    name = "app_test_ts",
    out_dir = "dist_test",
    srcs = [
        "app.test.ts",
        "app.ts",
    ],
    tsconfig = ":tsconfig.json",
    resolve_json_module = True,
    deps = [
        ":app_ts",
        ":node_modules/@types/node",
        ":node_modules/@types/supertest",
        ":node_modules/supertest",
    ],
)

js_test(
    name = "app_routes_test",
    data = [
        ":app_ts",
        ":app_test_ts",
    ],
    entry_point = "dist_test/app.test.js",
)

js_binary(
    name = "market_data_service_bin",
    data = select({
        "//conditions:default": [
            ":app_ts",
        ],
        ":include_env": [
            ":app_ts",
            ":_env",
        ],
    }),
    entry_point = ":app_ts",
)
