import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @vagewell/shared is a sibling package (file:../shared, symlinked into
  // node_modules) rather than a real npm/yarn/pnpm workspace member, so Next
  // doesn't auto-detect and transpile it — list it explicitly. It ships raw
  // TypeScript with no build step, shared verbatim with the Expo mobile app.
  transpilePackages: ["@vagewell/shared"],
};

export default nextConfig;
