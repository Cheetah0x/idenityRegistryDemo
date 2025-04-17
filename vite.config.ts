import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.{js,ts}"],
    hookTimeout: 9999999,
    testTimeout: 9999999,
    deps: {
      inline: [/@aztec/],
    },
  },
})
