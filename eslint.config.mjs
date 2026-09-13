import next from 'eslint-config-next/core-web-vitals';
export default [
  ...next,
  { ignores: ['.next/**', 'node_modules/**', 'android-app/**', 'playwright-report/**', 'test-results/**'] },
  // Existing UI synchronizes settings with browser storage and uses <img> fallbacks.
  // Keep hooks dependency, invalid nesting, and standard Next rules enabled.
  { rules: { 'react-hooks/set-state-in-effect': 'off', 'react-hooks/refs': 'off', 'react-hooks/preserve-manual-memoization': 'off', 'react-hooks/immutability': 'off' } },
];
