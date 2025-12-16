import '@/style.css'
import { Renderer } from "@/render/renderer"
import { initAssetDatabase, type AssetManifest } from "@/assets/assetDatabase"
import { Game } from "@/game"
import { quitIfFeaturesNotAvailable, quitIfWebGPUNotAvailable } from '@/render/rendererUtils';
import { GlobalAssetManifest } from '@/manifest'
import getImageData, { initImageData } from '@/assets/imageData';

function getImageBitmapPixelData(context: CanvasRenderingContext2D, image: ImageBitmap): ImageData
{
	context.drawImage(image, 0, 0, image.width, image.height);
	return context.getImageData(0, 0, image.width, image.height);
}

async function init() {
	initImageData();

	var canvas = document.querySelector("#canvas") as HTMLCanvasElement;

	canvas.width = canvas.clientWidth * window.devicePixelRatio;
	canvas.height = canvas.clientHeight * window.devicePixelRatio;
	canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());

	const adapter = await navigator.gpu?.requestAdapter({
		featureLevel: 'compatibility',
	}) as GPUAdapter;
	
	quitIfFeaturesNotAvailable(adapter, ['timestamp-query']);
	
	const device = await adapter?.requestDevice({
		requiredFeatures: [
			'timestamp-query'
		]
	}) as GPUDevice;
	
	quitIfWebGPUNotAvailable(adapter, device);

	var assetDatabase = await initAssetDatabase(GlobalAssetManifest, device);
	console.log("asset database initialized!");

	new Game(canvas, device, assetDatabase);
}

function startInit() {
	return init();
}

(async () => {
	await startInit();
})();

