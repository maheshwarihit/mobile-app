// Metro config for an Expo app inside an npm-workspaces monorepo, plus NativeWind.
// Follows Expo's documented monorepo recipe: watch the workspace root and resolve
// modules from both the app's and the root's node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo (so changes to @vagewell/shared hot-reload).
config.watchFolders = [workspaceRoot];

// 2. Resolve node modules from the app first, then the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Only use the two paths above (prevents picking up the wrong React copy).
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
