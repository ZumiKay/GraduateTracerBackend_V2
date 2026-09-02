/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/**.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "contentTitleHelper\\.example\\.ts$",
    "EmailService\\.contentTitle\\.test\\.ts$",
    ".*\\.integration.*",
  ],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      // Use the test-specific tsconfig so Jest globals are typed correctly
      // and test files are not excluded from type resolution.
      tsconfig: "tsconfig.test.json",
    }],
  },
};
