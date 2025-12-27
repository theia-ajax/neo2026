import { GUI } from "dat.gui"
import * as debug from "@/debug/debug"
import { GameState } from "@/gamestate"
import { Renderer } from "@/render/renderer"
import { SampleBuffer } from "@/util"
import { AssetDatabase } from "@assets/assetDatabase"
import { createTextureFromImage } from "@/render/texture"
import { vec3 } from "wgpu-matrix"
import { Terrain } from '@/terrain'
import { createInputHandler, type InputHandler } from "@/input";
import { Camera, TankCameraController } from "@/render/camera"
import getImageData from "./assets/imageData"
import { createTerrainMeshFromHeightmapAsync } from "@/assets/meshes/heightmapTerrainAsync"
import { createMeshRenderable, type Mesh } from "@/render/mesh"
import { cubePositionOnly } from "@/assets/meshes/cube"
import { Physics } from "@/physics"
type RAPIER_API = typeof import("@dimforge/rapier3d");

export interface GameTime {
	deltaSec: number;
	fixedDeltaSec: number;
	deltaSecNoScale: number;
	fixedDeltaSecNoScale: number;
	elapsedSec: number;
	timeScale: number;
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

	constructor(canvas: HTMLCanvasElement, device: GPUDevice, assets: AssetDatabase, RAPIER: RAPIER_API) {
		this.canvas = canvas;
		this.device = device;
		this.assets = assets;

		this.physics = new Physics(RAPIER);

		this.inputHandler = createInputHandler(window, canvas);

		const FIXED_UPDATE_HERTZ = 120;
		const FIXED_DELTA_SECONDS = 1 / FIXED_UPDATE_HERTZ;

		this.gameState = new GameState();

		this.gameTime = {
			deltaSec: 0,
			deltaSecNoScale: 0,
			fixedDeltaSec: FIXED_DELTA_SECONDS,
			fixedDeltaSecNoScale: FIXED_DELTA_SECONDS,
			elapsedSec: 0,
			timeScale: 1.0,
		}


		this.gameState.terrain = new Terrain();
		const heightmapData = getImageData(this.assets.getAsset('heightmap').image);
		createTerrainMeshFromHeightmapAsync(
			heightmapData,
			{
				shading: 'diffuse',
				scale: vec3.create(1, 32, 1),
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
		this.gameState.cameraController = new TankCameraController(this.gameState.camera);
		this.gameState.camera.position = vec3.create(0, 30, 25);

		this.renderer = new Renderer(this.canvas, this.device, this.gameState);

		this.cpuSampler = new SampleBuffer(60);
		this.fpsSampler = new SampleBuffer(60);

		const settings = {
			showDebug: debug.getVisible(),
		};

		const gui = new GUI();
		gui.add(settings, 'showDebug').onChange(() => {
			debug.setVisible(settings.showDebug);
		});

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
	}

	private fixedUpdate(gameState: GameState) {
		gameState.cameraController?.update(gameState, gameState.time.fixedDeltaSec);
		this.physics.step();
		// gameState.terrain.rotation = -gameState.time.elapsedSec * Math.PI * 2 / 256;
	}

	private render(gameState: GameState) {
		const { vertices, colors } = this.physics.debugRender;
		this.renderer.setDebugLines(vertices, colors);

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
	}
}
