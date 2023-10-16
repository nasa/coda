import nextJest from "next/jest";

const createJestConfig = nextJest({
  // Your Next.js config
  dir: "./",
});

const config = {
  preset: "ts-jest/presets/js-with-ts",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "node"],
  moduleDirectories: ["node_modules", "src"],
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/__mocks__/fileMock.js",
    "\\.(css|scss)$": "identity-obj-proxy",
    "^__mocks__(.*)$": "<rootDir>/__mocks__$1",
    "^client/(.*)$": "<rootDir>/client/$1",
    "^components/(.*)$": "<rootDir>/components/$1",
    "^public/(.*)$": "<rootDir>/public/$1",
    "^server/(.*)$": "<rootDir>/server/$1",
    "^services/(.*)$": "<rootDir>/services/$1",
    "^store/(.*)$": "<rootDir>/store/$1",
    "^typings$": "<rootDir>/typings/index.d",
    "^typings/(.*)$": "<rootDir>/typings/$1",
    "^utils/(.*)$": "<rootDir>/utils/$1",
  },
  collectCoverageFrom: [
    "**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!jest.config.ts",
    "!next.config.js",
    "!**/node_modules/**",
    "!**/.local/**",
    "!**/.cache/**",
    "!**/.vscode/**",
    "!**/coverage/**",
    "!**/dist/**",
    "!**/out/**",
    "!**/.next/**",
    "!**/.cache/**",
    "!**/.vscode/**",
    "!**/coverage/**",
    "!**/dist/**",
    "!**/out/**",
  ],
  coverageReporters: ["text", "lcov", "cobertura"],
  globalSetup: "<rootDir>/jest.globalSetup.ts",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/utils/jest-extends.ts"],
  testPathIgnorePatterns: [
    "<rootDir>/.cookies/",
    "<rootDir>/node_modules/",
    "<rootDir>/out",
    "<rootDir>/.gitlab/",
    "<rootDir>/.local/",
    "<rootDir>/.next/",
    "<rootDir>/.swc/",
    "<rootDir>/.vscode/",
  ],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.jest.json",
      // https://huafu.github.io/ts-jest/user/config/diagnostics#examples
      // TODO: turn this on after js->ts conversion is complete
      diagnostics: false,
    },
  },
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
};

export default createJestConfig(config);
