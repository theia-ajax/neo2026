import { GUI } from "dat.gui"
import * as debug from "@/debug/debug"
import { GameState } from "@/gamestate"
import { Renderer } from "@/render/renderer"
import { SampleBuffer } from "@/util"
import { AssetDatabase } from "@assets/assetDatabase"
import { createTextureFromImage } from "@/render/texture"
import { Terrain } from '@/terrain'
import { createInputHandler, type InputHandler } from "@/input";
import { Camera, TankCameraController, AutoOrbitCameraController } from "@/render/camera"
import getImageData from "./assets/imageData"
import { createTerrainMeshFromHeightmapAsync } from "@/assets/meshes/heightmapTerrainAsync"
import { createMeshRenderable, type Mesh } from "@/render/mesh"
import { cubePositionOnly } from "@/assets/meshes/cube"
import { Physics } from "@/physics"
import { vec3, vec4, mat3, mat4, type Vec3, type Vec4, type Mat3, type Mat4 } from 'wgpu-matrix'
type RAPIER_API = typeof import("@dimforge/rapier3d");

const FIXED_UPDATE_HERTZ = 60;
const FIXED_DELTA_SECONDS = 1 / FIXED_UPDATE_HERTZ;


export interface GameTime {
	deltaSec: number;
	fixedDeltaSec: number;
	deltaSecNoScale: number;
	fixedDeltaSecNoScale: number;
	elapsedSec: number;
	timeScale: number;
	frame: number;
}

interface GameCallback {
	(gameState: GameState): void;
}

class GameCallbackDriver {
	public name: string;
	public interval: number = 0;
	public callback: GameCallback;
	private accumulator: number = 0;
	private maxCallsPerUpdate: number = 10;
	private numCallsLastUpdate: number = 0;

	constructor(name: string, callback: GameCallback, callsPerSecond: number = 0) {
		this.name = name;
		this.interval = (callsPerSecond > 0) ? 1.0 / callsPerSecond : 0;
		if (this.interval == 0) {
			this.maxCallsPerUpdate = 1;
		}
		this.callback = callback;
		this.accumulator = 0;
	}

	public update(gameState: GameState) {
		const deltaTime = Math.min(gameState.time.deltaSec, 1.0);
		this.accumulator += deltaTime;
		this.accumulator = Math.min(this.accumulator, this.maxCallsPerUpdate * this.interval);
		var callsThisUpdate = 0;
		while (this.accumulator >= this.interval && callsThisUpdate < this.maxCallsPerUpdate) {
			this.callback(gameState);
			this.accumulator -= this.interval;
			callsThisUpdate++;
		}
		this.numCallsLastUpdate = callsThisUpdate;
	}

	public get callsLastUpdate() { return this.numCallsLastUpdate; }
}

export class Game {
	private canvas: HTMLCanvasElement;
	private device: GPUDevice;
	private gameState: GameState;
	private renderer: Renderer;
	private assets: AssetDatabase;
	private currentTime: number = 0;
	private gameCallbacks: Array<GameCallbackDriver>;
	private cpuSampler: SampleBuffer;
	private fpsSampler: SampleBuffer;
	private inputHandler: InputHandler;
	private physics: Physics;

	reset() {
		this.physics.resetWorld();
		const physHeightmapData = getImageData(this.assets.getAsset('heightmap').image);
		this.physics.createHeightmapCollider(physHeightmapData, vec3.create(0.25, 16, 0.25));
	}


	constructor(canvas: HTMLCanvasElement, device: GPUDevice, assets: AssetDatabase, RAPIER: RAPIER_API) {
		this.canvas = canvas;
		this.device = device;
		this.assets = assets;


		this.inputHandler = createInputHandler(window, canvas);


		this.physics = new Physics(RAPIER, { integration: { dt: FIXED_DELTA_SECONDS } });

		this.gameState = new GameState();

		this.gameTime = {
			deltaSec: 0,
			deltaSecNoScale: 0,
			fixedDeltaSec: FIXED_DELTA_SECONDS,
			fixedDeltaSecNoScale: FIXED_DELTA_SECONDS,
			elapsedSec: 0,
			timeScale: 1.0,
			frame: 0,
		}
		this.gameState.input = this.inputHandler();

		this.gameState.terrain = new Terrain();
		const physHeightmapData = getImageData(this.assets.getAsset('heightmap').image);
		this.physics.createHeightmapCollider(physHeightmapData, vec3.create(0.25, 16, 0.25));
		const visHeightmapData = getImageData(this.assets.getAsset('heightmap').image);
		createTerrainMeshFromHeightmapAsync(
			visHeightmapData,
			{
				shading: 'diffuse',
				scale: vec3.create(0.25, 16, 0.25),
			},
			(mesh: Mesh) => {
				this.gameState.terrain.initFromHeightmapMesh(this.device, mesh);
			});
		this.gameState.terrainTexture = createTextureFromImage(this.device, this.assets.getAsset("roots_1_diffuse").image);
		this.gameState.terrainNormalTexture = createTextureFromImage(this.device, this.assets.getAsset('roots_1_normal').image);

		this.gameState.skyboxRenderMesh = createMeshRenderable(this.device, cubePositionOnly);

		const skyboxImages = [
			this.assets.getAsset("skybox01_px").image,
			this.assets.getAsset("skybox01_nx").image,
			this.assets.getAsset("skybox01_py").image,
			this.assets.getAsset("skybox01_ny").image,
			this.assets.getAsset("skybox01_pz").image,
			this.assets.getAsset("skybox01_nz").image,
		]
		const skyboxTexture = device.createTexture({
			label: 'skybox cubemap',
			dimension: '2d',
			textureBindingViewDimension: 'cube',
			size: [skyboxImages[0].width, skyboxImages[0].height, 6],
			format: 'rgba8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
		});
		for (let i = 0; i < skyboxImages.length; i++) {
			const image = skyboxImages[i];
			device.queue.copyExternalImageToTexture(
				{ source: image },
				{ texture: skyboxTexture, origin: [0, 0, i] },
				[image.width, image.height],
			);
		}
		this.gameState.skyboxTexture = skyboxTexture;

		this.gameState.camera = new Camera();


		this.gameState.orbitCameraController = new AutoOrbitCameraController(this.gameState.camera);
		{
			let cc = this.gameState.orbitCameraController;
			cc.target = vec3.create(0, 8, 0);
			cc.orbitRate = 7.5;
			cc.distance = 30;
			cc.zenith = 25;
		}

		this.gameState.camera.position = vec3.create(0, 24, 15);
		this.gameState.tankCameraController = new TankCameraController(this.gameState.camera);
		this.gameState.tankCameraController.update(this.gameState, 0);

		this.gameState.cameraController = this.gameState.tankCameraController;
		// this.gameState.cameraController = this.gameState.orbitCameraController;
		// // this.gameState.camera.position = vec3.create(0, 0, 5);
		// this.gameState.camera.position = vec3.create(0, 16, 20);
		// this.gameState.camera.position = vec3.create(-120, 10, -100);

		const settings = {
			showDebug: debug.getVisible(),
			cameraType: 'orbit',
			tankCameraMoveSpeed: this.gameState.tankCameraController.moveSpeed,
			tankCameraTurnRate: this.gameState.tankCameraController.turnRateDegrees,
			orbitCameraHeight: this.gameState.orbitCameraController.target[1],
			orbitCameraDistance: this.gameState.orbitCameraController.distance,
			orbitCameraZenith: this.gameState.orbitCameraController.zenith,
			orbitCameraOrbitRate: this.gameState.orbitCameraController.orbitRate,
			reset: () => { this.reset(); }
		};

		this.renderer = new Renderer(this.canvas, this.device, this.gameState);

		this.cpuSampler = new SampleBuffer(60);
		this.fpsSampler = new SampleBuffer(60);

		const gui = new GUI();
		gui.close();
		gui.add(settings, 'showDebug').onChange(() => {
			debug.setVisible(settings.showDebug);
		});
		gui.add(settings, 'cameraType', { Orbit: 'orbit', Tank: 'tank' }).onChange(() => {
			console.log(settings.cameraType);
			this.gameState.cameraController = this.gameState.cameraControllers[settings.cameraType];
			this.gameState.cameraController.restoreState();
		});
		const tankCameraFolder = gui.addFolder('Tank Camera');
		{
			tankCameraFolder.add(settings, 'tankCameraMoveSpeed', 0, 20).name('Move Speed').onChange(() => {
				this.gameState.tankCameraController.moveSpeed = settings.tankCameraMoveSpeed;
			});
			tankCameraFolder.add(settings, 'tankCameraTurnRate', 1, 360).name('Turn Rate').onChange(() => {
				this.gameState.tankCameraController.turnRateDegrees = settings.tankCameraTurnRate;
			});
		}
		const orbitCameraFolder = gui.addFolder('Orbit Camera');
		{
			orbitCameraFolder.add(settings, 'orbitCameraHeight', 0, 20).name('Height').onChange(() => {
				this.gameState.orbitCameraController.target[1] = settings.orbitCameraHeight
			});
			orbitCameraFolder.add(settings, 'orbitCameraDistance', 0.1, 64).name('Distance').onChange(() => {
				(this.gameState.cameraController as AutoOrbitCameraController).distance = settings.orbitCameraDistance;
			});
			orbitCameraFolder.add(settings, 'orbitCameraZenith', -90, 90).name('Zenith').onChange(() => {
				this.gameState.orbitCameraController.zenith = settings.orbitCameraZenith;
			});
			orbitCameraFolder.add(settings, 'orbitCameraOrbitRate', -90, 90).name('Orbit Rate').onChange(() => {
				this.gameState.orbitCameraController.orbitRate = settings.orbitCameraOrbitRate;
			});
		}
		gui.add(settings, 'reset').name('Reset World');


		this.gameCallbacks = [
			new GameCallbackDriver("Pre Frame", (gs: GameState) => { this.preFrame(gs); }),
			new GameCallbackDriver("Update", (gs: GameState) => { this.update(gs); }),
			new GameCallbackDriver("Fixed Update", (gs: GameState) => { this.fixedUpdate(gs); }, FIXED_UPDATE_HERTZ),
			new GameCallbackDriver("Render", (gs: GameState) => { this.render(gs); }),
			new GameCallbackDriver("Post Frame", (gs: GameState) => { this.postFrame(gs); }),
		];

		requestAnimationFrame((timestamp) => { this.mainLoop(timestamp) });
	}

	get gameTime() { return this.gameState.time; }
	set gameTime(gt: GameTime) { this.gameState.time = gt; }

	private setCurrentTime(newTime: DOMHighResTimeStamp) {
		this.currentTime = newTime * 1000.0;
	}

	private preFrame(gameState: GameState) {

	}

	private update(gameState: GameState) {
		gameState.cameraController?.update(gameState, gameState.time.deltaSec);
	}

	private fixedUpdate(gameState: GameState) {
		this.physics.step();
		// gameState.terrain.rotation = -gameState.time.elapsedSec * Math.PI * 2 / 256;
	}

	private render(gameState: GameState) {
		// const { vertices, colors } = this.physics.debugRender;
		// this.renderer.setDebugLines(vertices, colors);


		this.physics.renderColliders(this.renderer);

		// {
		// 	const a = gameState.time.elapsedSec;
		// 	const model =
		// 		mat4.scale(
		// 			mat4.rotateY(
		// 				mat4.translate(mat4.identity(), vec3.create(0, 20, 5)),
		// 				a),
		// 			vec3.create(1, 1, 1));
		// 	const normal = mat3.transpose(mat3.inverse(mat3.fromMat4(model)));
		// 	this.renderer.setObjectInstances([{
		// 		modelMatrix: model,
		// 		normalMatrix: normal
		// 	}]);
		// }

		// if (gameState.time.frame == 0)

		this.renderer.draw(gameState);
	}

	private postFrame(gameState: GameState) {
	}

	private mainLoop(newTime: DOMHighResTimeStamp) {
		requestAnimationFrame((timestamp) => { this.mainLoop(timestamp) });

		const mainLoopStartTime = performance.now();

		if (!this.currentTime) {
			this.setCurrentTime(newTime);
		}

		const deltaTimeMicro = newTime * 1000 - this.currentTime;
		const deltaTime = deltaTimeMicro / 1000000;
		this.gameTime.deltaSecNoScale = deltaTime;
		this.gameTime.deltaSec = this.gameTime.deltaSecNoScale * this.gameTime.timeScale;
		this.gameTime.fixedDeltaSec = this.gameTime.fixedDeltaSecNoScale * this.gameTime.timeScale;
		this.gameTime.elapsedSec += this.gameTime.deltaSec;

		this.gameState.input = this.inputHandler();

		for (var callbackIndex in this.gameCallbacks) {
			var gameCb = this.gameCallbacks[callbackIndex]
			gameCb.update(this.gameState);
		}

		this.setCurrentTime(newTime);

		if (deltaTime != 0) {
			this.fpsSampler.record(1 / deltaTime);
		}
		this.cpuSampler.record(performance.now() - mainLoopStartTime);

		debug.log(`FPS: ${(this.fpsSampler.slowAverage).toFixed(1)}`)
		debug.log(`CPU: ${(this.cpuSampler.average()).toFixed(3)}ms (Max ${(this.cpuSampler.max()).toFixed(3)}ms)`)
		debug.log(`GPU: ${(this.renderer.gpuSample.average() / 1000).toFixed(1)}μs (Max ${(this.renderer.gpuSample.max() / 1000).toFixed(1)}μs)`);

		const formatTime = (totalSeconds) => {
			const totalMinutes = totalSeconds / 60;
			const totalHours = totalMinutes / 60;
			const totalDays = totalHours / 24;

			const seconds = totalSeconds % 60;
			const minutes = Math.floor(totalMinutes);
			const hours = Math.floor(totalHours);
			const days = Math.floor(totalDays);

			const secondsDisplay = seconds.toFixed(3).padStart(6, "0")
			const minutesDisplay = minutes.toString().padStart(2, "0")
			const hoursDisplay = hours.toString().padStart(2, "0")
			const daysDisplay = days.toString().padStart(2, "0")

			return `${daysDisplay}:${hoursDisplay}:${minutesDisplay}:${secondsDisplay}`
		}
		debug.log(`Elapsed Time: ${formatTime(this.gameTime.elapsedSec)}`);

		const formatPos = (v) => {
			return `${v.at(0).toFixed(2)}, ${v.at(1).toFixed(2)}, ${v.at(2).toFixed(2)}`
		}
		debug.log(`Camera Pos: ${formatPos(this.gameState.camera.position)}`);

		debug.flush();

		this.gameState.time.frame++;
	}
}
