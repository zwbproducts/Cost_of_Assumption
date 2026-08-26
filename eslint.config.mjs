import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/**", ".next/**", ".open-next/**"],
  },
];

export default eslintConfig;
