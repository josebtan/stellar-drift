import { defineConfig } from "vite";

// GitHub Pages sirve el sitio en https://<user>.github.io/<repo>/
// así que el base path debe coincidir con el nombre del repositorio.
export default defineConfig({
  base: "/stellar-drift/",
});
