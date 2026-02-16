load("@npm//:defs.bzl", "npm_link_all_packages")
load("@aspect_rules_js//js:defs.bzl", "js_library")

package(default_visibility = ["//visibility:public"])

npm_link_all_packages(name = "node_modules")

js_library(
    name = "_env",
    srcs = [".env"],
    visibility = [
        "//libs/db:__pkg__",
        "//libs/db/migrations:__pkg__",
    ],
)

exports_files([
    ".env",
])
