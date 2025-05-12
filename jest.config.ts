const config = {
  preset: "ts-jest/presets/js-with-ts",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "node"],
  moduleDirectories: ["node_modules", "src"],
  rootDir: "./src",
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/__mocks__/fileMock.js",
    "\\.(css|scss)$": "identity-obj-proxy",
    "^__mocks__(.*)$": "<rootDir>/__mocks__$1",
    "^components/(.*)$": "<rootDir>/components/$1",
    "^http-client/(.*)$": "<rootDir>/http-client/$1",
    "^pages/(.*)$": "<rootDir>/pages/$1",
    "^public/(.*)$": "<rootDir>/public/$1",
    "^server/(.*)$": "<rootDir>/server/$1",
    "^store/(.*)$": "<rootDir>/store/$1",
    "^typings$": "<rootDir>/typings/index.d",
    "^typings/(.*)$": "<rootDir>/typings/$1",
    "^utils/(.*)$": "<rootDir>/utils/$1",
  },
  collectCoverageFrom: ["**/*.{js,jsx,ts,tsx}", "!**/*.d.ts"],
  coverageReporters: ["text", "lcov", "cobertura"],
  globalSetup: "<rootDir>/../jest.globalSetup.ts",
  setupFiles: ["<rootDir>/../jest.setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/utils/jest-extends.ts"],
  globals: {},
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.jest.json", warnOnly: true }],
  },
  transformIgnorePatterns: ["/node_modules/(?!tle.js/).*"],
};

export default config;
