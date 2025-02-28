export default {
  displayName: 'g11n-cli',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
      '^.+\\.[tj]s$': [
          'ts-jest',
          { tsconfig: '<rootDir>/tsconfig.spec.json' },
      ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/g11n-cli',
};
