import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'sim', exclude: ['**/node_modules/**', '**/*.slow.test.ts'] },
});
