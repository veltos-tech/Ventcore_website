import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // *.prev — сохранённая прошлая версия на сервере на время выпуска (deploy/ventcore-deploy).
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules.prev/**", ".next.prev/**"]),
]);
