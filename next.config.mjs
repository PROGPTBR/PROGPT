const TURNSTILE_TEST_SITE_KEYS = new Set([
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
]);

// NEXT_PUBLIC_* é incorporada ao JavaScript durante o build. Falhar aqui é
// mais seguro do que publicar um captcha dummy que todo usuário verá passar,
// mas cujo token será corretamente recusado pelo secret real no servidor.
if (process.env.APP_ENV === 'production') {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey || TURNSTILE_TEST_SITE_KEYS.has(siteKey)) {
    throw new Error(
      'Production requires a real NEXT_PUBLIC_TURNSTILE_SITE_KEY; Turnstile test keys are not allowed.',
    );
  }
  if (!process.env.TURNSTILE_SECRET_KEY) {
    throw new Error('Production requires TURNSTILE_SECRET_KEY.');
  }
}

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
