import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [".cursor/hooks/**/*.test.ts"],
  },
});
