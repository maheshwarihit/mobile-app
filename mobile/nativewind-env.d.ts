/// <reference types="nativewind/types" />

// NativeWind v4 ships no ambient declaration for `*.css`, so the side-effect
// `import "./global.css"` in App.tsx has nothing to resolve against (ts2882).
declare module "*.css";
