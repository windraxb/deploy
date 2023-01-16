import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'es2015',
  dts: true,
  clean: true,
  splitting: false,
  minify: true
})
