import react from "eslint-plugin-react";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import packageJson from "eslint-plugin-package-json";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

// Clean the browser globals to remove any keys with leading/trailing whitespace
const originalBrowserGlobals = globals.browser;
const cleanedBrowserGlobals = {};
for (const key in originalBrowserGlobals) {
  if (Object.prototype.hasOwnProperty.call(originalBrowserGlobals, key)) {
    const trimmedKey = key.trim();
    cleanedBrowserGlobals[trimmedKey] = originalBrowserGlobals[key];
  }
}

export default [
  {
    ignores: ["**/public/**/*", ".local/**/*", "node_modules/**/*", ".cache/**/*", "coverage/**/*"],
  },
  {
    plugins: {
      react,
      "@typescript-eslint": typescriptEslint,
      prettier,
      "package-json": packageJson,
    },

    languageOptions: {
      globals: {
        ...cleanedBrowserGlobals, // Use the cleaned globals
      },

      parser: tsParser,
      ecmaVersion: 12,
      sourceType: "module",

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
      "no-warning-comments": ["error", { terms: ["fixme", "tbd", "xxx"], location: "anywhere" }],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],

      "no-import-assign": "error",
      "no-unreachable": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lodash",
              message:
                "Please import only the functions you need from lodash, e.g., import sortBy from 'lodash/sortBy'.",
            },
            {
              name: "react-redux",
              importNames: ["useSelector", "shallowEqual"],
              message:
                "Use useAppSelector() instead of useSelector(), and refEqual()/shallowEqual()/deepEqual() from useAppSelector.ts versus other locations. These functions provide better CODA-specific defaults.",
            },
            {
              name: "assert",
              importNames: ["deepEqual"],
              message: "Use 'useAppSelector.ts/deepEqual'.",
            },
            {
              name: "react-redux",
              importNames: ["useDispatch"],
              message:
                "Use utils/useAppDispatch() instead of useDispatch(). This will allow usage of the full store types",
            },
          ],
        },
      ],
      "linebreak-style": ["error", "unix"], // enforce unix (lf) linebreaks
      "package-json/restrict-dependency-ranges": [
        "error",
        {
          rangeType: "pin", // require that packages have pinned versions
        },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
  },
];
