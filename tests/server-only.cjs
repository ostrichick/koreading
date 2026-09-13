// Next.js enforces this import boundary during build. Node's test runner is a server;
// replace only the marker package, leaving all application/Firebase code real.
require.cache[require.resolve('server-only')] = { exports: {} };
