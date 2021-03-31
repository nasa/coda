module.exports = {
  preset: "ts-jest/presets/js-with-ts",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/__mocks__/fileMock.js",
    "\\.(css|scss)$": "identity-obj-proxy",
    "^__mocks__(.*)$": "<rootDir>/client/__mocks__$1",
    "^components/(.*)$": "<rootDir>/client/components/$1",
    "^public/(.*)$": "<rootDir>/client/public/$1",
    "^services/(.*)$": "<rootDir>/client/services/$1",
    "^store/(.*)$": "<rootDir>/client/store/$1",
    "^utils/(.*)$": "<rootDir>/client/utils/$1",
  },
  setupFiles: ["<rootDir>/jest.setup.js"],
  setupFilesAfterEnv: ["<rootDir>/client/utils/jest-extends.ts"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/out"],
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
