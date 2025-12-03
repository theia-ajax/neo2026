import '@/style.css'
import { Renderer } from "@/render/renderer"
import { initAssetDatabase, type AssetManifest } from "@/assets/assetDatabase"
import { Game } from "@/game"
import { quitIfFeaturesNotAvailable, quitIfWebGPUNotAvailable } from '@/render/rendererUtils';

async function init() {
	var canvas = document.querySelector("#canvas") as HTMLCanvasElement;
	canvas.width = canvas.clientWidth * window.devicePixelRatio;
	canvas.height = canvas.clientHeight * window.devicePixelRatio;

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

	var assetManifest: AssetManifest = {
		assets: [
			{
				name: "testimage",
				type: "IMAGE",
				path: "textures/testimage.png",
				importConfig: {
					type: "IMAGE",
					textureFormat: 'rgba8unorm',
				}
			}
		]
	};

	var assetDatabase = await initAssetDatabase(assetManifest, device);
	console.log("asset database initialized!");

	new Game(canvas, device, assetDatabase);
}

function startInit() {
	return init();
}

(async () => {
	await startInit();
})();

