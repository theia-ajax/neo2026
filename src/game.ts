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
import { Physics, type PhysicsScene } from "@/physics"
import { vec3, vec4, mat3, mat4, type Vec3, type Vec4, type Mat3, type Mat4 } from 'wgpu-matrix'
import { Mathx } from "@/core/mathx"
type RAPIER_API = typeof import("@dimforge/rapier3d");

const FIXED_UPDATE_HERTZ = 60;
const FIXED_DELTA_SECONDS = 1 / FIXED_UPDATE_HERTZ;

type LightType = 'point' | 'directional';

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

const TERRAIN_SCALE = 0.5;

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

	reset(scene?: PhysicsScene) {
		this.physics.resetWorld(scene);
		const physHeightmapData = getImageData(this.assets.getAsset('heightmap').image);
		this.physics.createHeightmapCollider(physHeightmapData, vec3.create(TERRAIN_SCALE, 16, TERRAIN_SCALE));
	}

	physicsSettingsFromWorldSettings(worldSettings: any) {
		return {
			objectCount: worldSettings.objectCount,
			spawnOffset: worldSettings.spawnOffset,
			spawnExtents: worldSettings.spawnExtents,
		};
	}

	constructor(canvas: HTMLCanvasElement, device: GPUDevice, assets: AssetDatabase, RAPIER: RAPIER_API) {
		let demoMode = location.hostname != 'localhost';
		// demoMode = true;

		this.canvas = canvas;
		this.device = device;
		this.assets = assets;

		this.inputHandler = createInputHandler(window, canvas);

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

		const visHeightmapData = getImageData(this.assets.getAsset('heightmap').image);
		createTerrainMeshFromHeightmapAsync(
			visHeightmapData,
			{
				shading: 'diffuse',
				scale: vec3.create(TERRAIN_SCALE, 16, TERRAIN_SCALE),
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
			cc.target = vec3.create(0, 6, 0);
			cc.orbitRate = 7.5;
			cc.distance = 35;
			cc.zenith = 25;
		}

		this.gameState.camera.position = vec3.create(0, 15, 15);
		this.gameState.tankCameraController = new TankCameraController(this.gameState.camera);
		this.gameState.tankCameraController.update(this.gameState, 0);

		debug.setVisible(!demoMode);

		const settings = {
			showDebug: demoMode ? false : debug.getVisible(),
			cameraType: demoMode ? 'orbit' : 'tank',
			tankCameraMoveSpeed: this.gameState.tankCameraController.moveSpeed,
			tankCameraTurnRate: this.gameState.tankCameraController.turnRateDegrees,
			orbitCameraHeight: this.gameState.orbitCameraController.target[1],
			orbitCameraDistance: this.gameState.orbitCameraController.distance,
			orbitCameraZenith: this.gameState.orbitCameraController.zenith,
			orbitCameraOrbitRate: this.gameState.orbitCameraController.orbitRate,
			world: {
				objectCount: 256,
				spawnExtents: { x: 2, y: 12, z: 2 },
				spawnOffset: { x: 0, y: 21, z: 0 },
				reset: () => {
					this.reset(this.physicsSettingsFromWorldSettings(settings.world));
				},
			},
			lighting: {
				globalZenith: 15.0,
				globalAzimuth: 180.0,
				diffuseScalar: 0.3,
				ambientScalar: 0.0,
				color: "#e3c06a"
			}
		};

		this.gameState.cameraController = this.gameState.cameraControllers[settings.cameraType];
		this.gameState.cameraController.restoreState();

		this.renderer = new Renderer(this.canvas, this.device, this.gameState);

		this.cpuSampler = new SampleBuffer(60);
		this.fpsSampler = new SampleBuffer(60);

		const cameraFolders = {};

		const gui = new GUI();
		if (demoMode) {
			// gui.close();
		}
		gui.add(settings, 'showDebug').onChange(() => {
			debug.setVisible(settings.showDebug);
		});
		gui.add(settings, 'cameraType', { Orbit: 'orbit', Tank: 'tank' }).onChange(() => {
			for (var key in cameraFolders) {
				cameraFolders[key].close();
			}
			cameraFolders[settings.cameraType].open();
			this.gameState.cameraController = this.gameState.cameraControllers[settings.cameraType];
			this.gameState.cameraController.restoreState();
		});

		const cameraFolder = gui.addFolder('Camera');
		const tankCameraFolder = cameraFolder.addFolder('Tank Camera');
		cameraFolders['tank'] = tankCameraFolder;
		{
			tankCameraFolder.add(settings, 'tankCameraMoveSpeed', 0, 20).name('Move Speed').onChange(() => {
				this.gameState.tankCameraController.moveSpeed = settings.tankCameraMoveSpeed;
			});
			tankCameraFolder.add(settings, 'tankCameraTurnRate', 1, 360).name('Turn Rate').onChange(() => {
				this.gameState.tankCameraController.turnRateDegrees = settings.tankCameraTurnRate;
			});
		}
		const orbitCameraFolder = cameraFolder.addFolder('Orbit Camera');
		cameraFolders['orbit'] = orbitCameraFolder;
		{
			orbitCameraFolder.add(settings, 'orbitCameraHeight', 0, 20).name('Height').onChange(() => {
				this.gameState.orbitCameraController.target[1] = settings.orbitCameraHeight
			});
			orbitCameraFolder.add(settings, 'orbitCameraDistance', 0.1, 128).name('Distance').onChange(() => {
				(this.gameState.cameraController as AutoOrbitCameraController).distance = settings.orbitCameraDistance;
			});
			orbitCameraFolder.add(settings, 'orbitCameraZenith', -90, 90).name('Zenith').onChange(() => {
				this.gameState.orbitCameraController.zenith = settings.orbitCameraZenith;
			});
			orbitCameraFolder.add(settings, 'orbitCameraOrbitRate', -90, 90).name('Orbit Rate').onChange(() => {
				this.gameState.orbitCameraController.orbitRate = settings.orbitCameraOrbitRate;
			});
		}
		const lightingFolder = gui.addFolder('Lighting');
		// lightingFolder.open();
		{
			const updateDirectionalLight = (lighting) => {
				const theta = -lighting.globalAzimuth * Mathx.deg2Rad;
				const phi = -lighting.globalZenith * Mathx.deg2Rad;

				const direction = vec3.create(
					Math.cos(theta) * Math.cos(phi),
					Math.sin(phi),
					Math.sin(theta) * Math.cos(phi),
				);

				const hex = parseInt(lighting.color.substring(1), 16);
				const blue = (hex & 0xFF) / 255.0;
				const green = ((hex >> 8) & 0xFF) / 255.0;
				const red = ((hex >> 16) & 0xFF) / 255.0;
				const color = vec3.create(red, green, blue);

				this.renderer.updateDirectionalLight(
					direction, color, lighting.diffuseScalar, lighting.ambientScalar);
			}

			lightingFolder.add(settings.lighting, 'globalZenith', -90, 90).name('Global Pitch').onChange(() => { updateDirectionalLight(settings.lighting); });
			lightingFolder.add(settings.lighting, 'globalAzimuth', 0, 360).name('Global Yaw').onChange(() => { updateDirectionalLight(settings.lighting); });
			lightingFolder.add(settings.lighting, 'diffuseScalar').name('Diffuse Scalar').onChange(() => { updateDirectionalLight(settings.lighting); });
			lightingFolder.add(settings.lighting, 'ambientScalar', 0.0, 1.0).name('Ambient Scalar').onChange(() => { updateDirectionalLight(settings.lighting); });
			lightingFolder.addColor(settings.lighting, 'color').onChange(() => { updateDirectionalLight(settings.lighting); });

			updateDirectionalLight(settings.lighting);
		}
		const worldFolder = gui.addFolder('World');
		// worldFolder.open();
		{
			worldFolder.add(settings.world, 'objectCount', 0, 4096).name('Object Count').onChange(() => settings.world.reset());
			worldFolder.add(settings.world.spawnOffset, 'x').name('Spawn Offset X').onChange(() => settings.world.reset());
			worldFolder.add(settings.world.spawnOffset, 'y').name('Spawn Offset Y').onChange(() => settings.world.reset());
			worldFolder.add(settings.world.spawnOffset, 'z').name('Spawn Offset Z').onChange(() => settings.world.reset());
			worldFolder.add(settings.world.spawnExtents, 'x').name('Spawn Extents X').onChange(() => settings.world.reset());
			worldFolder.add(settings.world.spawnExtents, 'y').name('Spawn Extents Y').onChange(() => settings.world.reset());
			worldFolder.add(settings.world.spawnExtents, 'z').name('Spawn Extents Z').onChange(() => settings.world.reset());
			worldFolder.add(settings.world, 'reset').name('Reset World');
		}

		for (var key in cameraFolders) {
			if (key == settings.cameraType) {
				cameraFolders[key].open();
			} else {
				cameraFolders[key].close();
			}
		}

		this.physics = new Physics(
			RAPIER,
			{ integration: { dt: FIXED_DELTA_SECONDS } },
			this.physicsSettingsFromWorldSettings(settings.world));
		const physHeightmapData = getImageData(this.assets.getAsset('heightmap').image);
		this.physics.createHeightmapCollider(physHeightmapData, vec3.create(TERRAIN_SCALE, 16, TERRAIN_SCALE));

		this.gameCallbacks = [
			new GameCallbackDriver("Pre Frame", (gs: GameState) => { this.preFrame(gs); }),
			new GameCallbackDriver("Update", (gs: GameState) => { this.update(gs); }),
			new GameCallbackDriver("Fixed Update", (gs: GameState) => { this.fixedUpdate(gs); }, FIXED_UPDATE_HERTZ),
			new GameCallbackDriver("Render", (gs: GameState) => { this.render(gs); }),
			new GameCallbackDriver("Post Frame", (gs: GameState) => { this.postFrame(gs); }),
		];

		// setInterval(() => { this.reset() }, 20 * 1000.0);

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
			const minutes = Math.floor(totalMinutes) % 60;
			const hours = Math.floor(totalHours) % 24;
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
