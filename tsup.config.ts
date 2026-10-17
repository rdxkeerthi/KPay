import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'qr/index': 'src/qr/index.ts',
    'security/index': 'src/security/index.ts',
    'adapters/phonepe': 'src/adapters/phonepe.ts',
    'adapters/paytm': 'src/adapters/paytm.ts',
    'adapters/bharatpe': 'src/adapters/bharatpe.ts',
    'adapters/mock': 'src/adapters/mock.ts',
    'adapters/direct': 'src/adapters/direct.ts',
    'realtime/index': 'src/realtime/index.ts',
    'direct/index': 'src/direct/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
});
