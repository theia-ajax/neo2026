import '@/style.css'
import { initRenderer, Renderer } from "@/render/renderer"
import { Game } from "@/game.ts"

async function init() {
	var canvas = document.querySelector("#canvas") as HTMLCanvasElement;
	canvas.width = canvas.clientWidth * window.devicePixelRatio;
	canvas.height = canvas.clientHeight * window.devicePixelRatio;

	var renderer = await initRenderer(canvas);

	new Game(renderer);
}

function startInit() {
	return init();
}

(async () => {
	await startInit();
})();

