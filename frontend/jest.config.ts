import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        // Disable type-checking in tests for speed
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    // Mirror Vite's @/ alias
    '^@/(.*)$': '<rootDir>/src/$1',
    // Stub CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Stub image/asset imports
    '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/src/__tests__/setup/__mocks__/fileMock.ts',
  },
  setupFilesAfterSetup: ['<rootDir>/src/__tests__/setup/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Coverage
  collectCoverageFrom: [
    'src/api/**/*.{ts,tsx}',
    'src/contexts/**/*.{ts,tsx}',
    'src/components/auth/**/*.{ts,tsx}',
    'src/schemas/**/*.{ts,tsx}',
    'src/pages/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};

export default config;
