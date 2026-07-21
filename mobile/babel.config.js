module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Resolves the "@/…" alias for the app's own src (Metro ignores tsconfig paths).
      // NOTE: the reanimated worklets plugin is added automatically by
      // babel-preset-expo — do NOT add it here (SDK 52 handles it).
      [
        "module-resolver",
        {
          root: ["./"],
          alias: { "@": "./src" },
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      ],
    ],
  };
};
