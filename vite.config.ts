import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: './src/cli.ts',
    outDir: './dist',
    target: 'ES2020',
    sourcemap: true,
  },
  fmt: {
    singleQuote: true,
  },
  staged: {
    '*': 'vp check --fix',
  },
});
