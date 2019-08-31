module.exports = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(/__tests__/integration/.*(test|spec)).tsx?$',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/src/__tests__/integration/setup.ts'
}
