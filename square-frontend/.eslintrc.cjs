module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs", "*.mjs"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  settings: { react: { version: "18.2" } },
  plugins: ["react-refresh"],
  rules: {
    "react/prop-types": "off",
    "react-refresh/only-export-components": "off",
    // Plain apostrophes/quotes in UI copy are fine
    "react/no-unescaped-entities": "off",
    // The data layer's demo helpers are stable by design; deps are managed manually
    "react-hooks/exhaustive-deps": "off",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};
