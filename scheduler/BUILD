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

ts_project(
    name = "scheduler_ts",
    out_dir = "dist",
    srcs = [
        "app.ts",
        "universe.ts",
    ],
    tsconfig = ":tsconfig.json",
    resolve_json_module = True,
    deps = [
        ":node_modules/@types/node",
        ":node_modules/dotenv",
    ],
)

js_library(
    name = "_env",
    srcs = [".env"],
)

js_binary(
    name = "scheduler_bin",
    data = select({
        "//conditions:default": [
            ":scheduler_ts",
        ],
        ":include_env": [
            ":scheduler_ts",
            ":_env",
        ],
    }),
    entry_point = "dist/app.js",
)
