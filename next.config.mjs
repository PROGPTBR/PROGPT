/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output: Next.js traces the dependency graph and emits
  // only the modules actually imported at runtime into .next/standalone.
  // Without this, Railpack copies the entire node_modules (~1024 pkgs)
  // into the final container image and the build runs out of ephemeral
  // disk during image assembly. The runtime starts via
  // `node .next/standalone/server.js` — see Railway start command.
  output: 'standalone',
  experimental: {
    // `@napi-rs/canvas` ships platform-specific `.node` binaries that
    // webpack can't bundle (parses as "Unexpected character"). Treating
    // it as an external server-side package keeps it as a runtime
    // require, not a build-time bundle target. Same rationale would
    // apply to any future native server-only dep.
    serverComponentsExternalPackages: ['@napi-rs/canvas'],
  },
};

export default nextConfig;
