import { defineConfig } from 'vite';
import path from "path";

export default defineConfig({
	build: {
		outDir: path.resolve(__dirname, "./dist"),
		assetsDir: 'assets',
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			"@assets": path.resolve(__dirname, "./src/assets"),
			"@shaders": path.resolve(__dirname, "./src/assets/shaders"),
			"@meshes": path.resolve(__dirname, "./src/assets/meshes")
		},
	},
});