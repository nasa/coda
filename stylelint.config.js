export default {
  extends: [
    "stylelint-config-standard", // Standard Stylelint rules
    "stylelint-config-css-modules", // Config for CSS Modules compatibility
  ],
  ignoreFiles: ["src/coverage/**/*", "coverage/**/*"],
  rules: {
    // General rules - customize as needed
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["value", "import", "export"], // Retain for clarity if preferred
      },
    ],
    "font-family-name-quotes": "always-where-recommended",
    "color-hex-length": "long",
    "shorthand-property-no-redundant-values": null,
    "declaration-block-no-redundant-longhand-properties": null,
    "comment-empty-line-before": null,
    "rule-empty-line-before": null,
    "declaration-empty-line-before": null,
    // Performance and best practices
    "no-duplicate-selectors": true,
    "color-no-invalid-hex": true,
    "font-family-no-duplicate-names": true,
    "function-calc-no-unspaced-operator": true,
    "unit-no-unknown": true,
    "property-no-unknown": true,
    "declaration-block-no-duplicate-properties": true,

    // CSS Custom Properties (CSS Variables) - allow both kebab-case and camelCase
    "custom-property-pattern": "^([a-z][a-z0-9]*)(-[a-z0-9]+)*$|^([a-z][a-zA-Z0-9]+)$",

    "selector-class-pattern": null,
    "selector-id-pattern": null, // Allow any ID selector pattern (including camelCase)
  },
  overrides: [
    {
      files: ["**/*.css", "!**/*.module.css"], // For regular CSS files
      rules: {
        // No class pattern enforcement for regular CSS files
      },
    },
    {
      files: ["**/*.module.css"], // Specifically for CSS Modules
      rules: {
        // No class pattern enforcement for CSS modules
      },
    },
  ],
};
