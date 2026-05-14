/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
