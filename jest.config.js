/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "contentTitleHelper\\.example\\.ts$",
    "EmailService\\.contentTitle\\.test\\.ts$",
  ],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
