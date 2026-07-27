/**
 * Jest 30 running native ESM.
 *
 * Note `npm test` sets NODE_OPTIONS=--experimental-vm-modules (via cross-env):
 * Jest's ESM support still requires that flag. There is deliberately no Babel
 * transform — the source runs as-is, so what tests exercise is what ships.
 *
 * `jest.mock()` does not work under ESM. Rather than reach for
 * `jest.unstable_mockModule`, services are injected into route factories, so
 * tests pass plain fakes. That constraint pushed the code toward dependency
 * injection, which is the better shape anyway.
 */
export default {
  testEnvironment: 'node',
  transform: {}, // no transpilation: native ESM
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/instrument.js',
    '!src/server.js',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  // Surfaces a handle left open by a stray listener or cron job.
  detectOpenHandles: false,
  testTimeout: 15_000,
};
