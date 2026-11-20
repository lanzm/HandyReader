import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig(async () => {
  const UnoCSS = (await import("unocss/vite")).default;
  return {
    plugins: [uni(), UnoCSS()],
    build: {
      rollupOptions: {
        output: {
          chunkFileNames: "common/[name].js",
        },
      },
    },
  };
});
