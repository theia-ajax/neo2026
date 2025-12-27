import { defineConfig } from 'vite'
import path from "path"
import wasm from "vite-plugin-wasm"

export default defineConfig({
	plugins: [
		wasm(),
	],
	root: 'src',
	base: 'https://theia.gay/neo',
	publicDir: 'public',
	build: {
		outDir: '../dist',
		emptyOutDir: true,
		sourcemap: true,
		minify: 'esbuild',
		assetsDir: '.',
		emitAssets: true,
		rollupOptions: {
			input: path.resolve(__dirname, 'src/index.html'),
			output: {
				assetFileNames: 'assets/[name]-[hash][extname]'
			}
		}
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
			"@assets": path.resolve(__dirname, "src/assets"),
			"@shaders": path.resolve(__dirname, "src/assets/shaders"),
			"@meshes": path.resolve(__dirname, "src/assets/meshes")
		},
	}
});