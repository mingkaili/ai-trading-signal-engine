load("@aspect_rules_js//js:defs.bzl", "js_binary", "js_image_layer", "js_library")
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")
load("@npm//:defs.bzl", "npm_link_all_packages")
load("@rules_oci//oci:defs.bzl", "oci_image", "oci_tarball")

package(default_visibility = ["//visibility:public"])

exports_files([
    ".env",
    ".envsample",
    "package.json",
])

npm_link_all_packages(name = "node_modules")

platform(
    name = "linux_amd64",
    constraint_values = [
        "@platforms//os:linux",
        "@platforms//cpu:x86_64",
    ],
)

platform(
    name = "linux_arm64",
    constraint_values = [
        "@platforms//os:linux",
        "@platforms//cpu:arm64",
    ],
)

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

js_image_layer(
    name = "scheduler_layers",
    binary = ":scheduler_bin",
    platform = select({
        "@platforms//cpu:arm64": ":linux_arm64",
        "@platforms//cpu:x86_64": ":linux_amd64",
    }),
    root = "/app",
    tags = ["no-remote-exec"],
)

oci_image(
    name = "scheduler_image",
    base = "@node",
    cmd = [
        "/app/scheduler/scheduler_bin.runfiles/_main/scheduler/dist/app.js",
        "--schedule",
        "true",
    ],
    entrypoint = ["node"],
    tars = [
        ":scheduler_layers",
    ],
)

oci_tarball(
    name = "scheduler_image_tarball",
    image = ":scheduler_image",
    repo_tags = ["scheduler:latest"],
)
