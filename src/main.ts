import '@/style.css'
import { initRenderer, Renderer } from "@/render/renderer"
import { Game } from "@/game"

async function init() {
	var canvas = document.querySelector("#canvas") as HTMLCanvasElement;
	canvas.width = canvas.clientWidth * window.devicePixelRatio;
	canvas.height = canvas.clientHeight * window.devicePixelRatio;

	console.log("before initRenderer");
	var renderer = await initRenderer(canvas);
	console.log("after initRenderer");

	new Game(renderer);
}

function startInit() {
	return init();
}

(async () => {
	await startInit();
})();

