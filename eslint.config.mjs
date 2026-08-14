import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import packageJson from "eslint-plugin-package-json";
import cssModules from "eslint-plugin-css-modules";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

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
    ignores: [
      "**/public/**/*",
      ".local/**/*",
      "node_modules/**/*",
      ".cache/**/*",
      "**/coverage/**/*",
      "**/suncalc.js",
    ],
  },
  ...fixupConfigRules(compat.extends("prettier", "plugin:react-hooks/recommended")),

  // Configuration specifically for package.json files
  {
    ...packageJson.configs.recommended,
    files: ["**/package.json"],
    rules: {
      "package-json/restrict-dependency-ranges": [
        "error",
        {
          rangeType: "pin", // require that packages have pinned versions
        },
      ],
    },
  },

  // Configuration for TypeScript files
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: {
      react,
      "react-hooks": fixupPluginRules(reactHooks),
      "@typescript-eslint": typescriptEslint,
      prettier,
      "css-modules": cssModules,
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

      "no-implied-eval": "error",
      "no-bitwise": "error",
      "no-eval": "error",
      "no-extend-native": "error",
      "no-array-constructor": "error",
      "no-caller": "error",

      "no-constant-condition": ["error", { checkLoops: false }],

      "no-empty": ["error", { allowEmptyCatch: true }],

      "no-extra-bind": "error",
      "no-extra-label": "error",

      "no-implicit-coercion": ["error", { string: true, boolean: false, number: false }],

      "no-implicit-globals": "error",
      "no-label-var": "error",
      "no-loop-func": "error",
      "no-multi-spaces": "error",
      "no-multi-str": "error",
      "no-new": "error",
      "no-new-func": "error",
      "no-new-object": "error",
      "no-new-wrappers": "error",
      "no-octal-escape": "error",
      "no-proto": "error",
      "no-prototype-builtins": "error",

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

      "no-return-assign": "error",
      "no-script-url": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-shadow-restricted-names": "error",
      "no-throw-literal": "error",
      "no-unmodified-loop-condition": "error",

      "no-unneeded-ternary": ["error", { defaultAssignment: false }],

      "no-unused-expressions": "error",
      "no-useless-call": "error",
      "no-void": ["error", { allowAsStatement: true }],
      "no-with": "error",
      "prefer-numeric-literals": "error",
      "unicode-bom": ["error"],
      "no-misleading-character-class": "error",
      "no-new-require": "error",
      "no-useless-computed-key": "error",
      "prefer-const": "error",
      "no-var": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],

      "prettier/prettier": ["error", { endOfLine: "auto", trailingComma: "es5" }],

      "no-import-assign": "error",
      "no-unreachable": "error",
      "react/jsx-no-target-blank": "error", // prevent security vulnerability: require rel="noopener noreferrer" with target="_blank"
      "linebreak-style": ["error", "unix"], // enforce unix (lf) linebreaks
      "react-hooks/set-state-in-effect": "off", // Allow setState in effects when intentional (e.g., syncing derived state, clearing state)

      // CSS Modules rules
      "css-modules/no-undef-class": ["error", { camelCase: true }],
      "css-modules/no-unused-class": ["error", { camelCase: true }],
    },
  },
];
