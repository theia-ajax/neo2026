import { defineConfig } from 'vite'
import path from "path"
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation'

export default defineConfig({
	root: 'src',
	build: {
		outDir: '../dist',
		emptyOutDir: true,
		sourcemap: true,
		minify: 'esbuild',
		assetsDir: 'assets',
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
	},
	plugins: [
		{
			name: "configure-response-headers",
			configureServer: (server) => {
				server.middlewares.use((_req, res, next) => {
					res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					next();
				});
			},
		}],
});