import { GUI } from "dat.gui"
import * as debug from "@/debug/debug"
import { GameState } from "@/gamestate"
import { Renderer } from "@/render/renderer"
import { SampleBuffer } from "@/util"
import { AssetDatabase } from "@assets/assetDatabase"
import { createTextureFromImage } from "@/render/texture"
import createHeightmapMesh from "@/assets/meshes/heightmap"
import { createMeshRenderable, getMeshVertex, type Mesh, type MeshRenderable } from "@/render/mesh"
import { vec3, type Vec3 } from "wgpu-matrix"
import { Terrain } from '@/terrain'
import { createInputHandler, type InputHandler } from "@/input";
import type Input from "@/input";

export interface GameTime {
	deltaSec: number;
	fixedDeltaSec: number;
	elapsedSec: number;
	timeScale: number;
}

interface GameCallback {
	(gameTime: GameTime): void;
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

	public update(gameTime: GameTime) {
		const deltaTime = Math.min(gameTime.deltaSec, 1.0);
		this.accumulator += deltaTime;
		this.accumulator = Math.min(this.accumulator, this.maxCallsPerUpdate * this.interval);
		var callsThisUpdate = 0;
		while (this.accumulator >= this.interval && callsThisUpdate < this.maxCallsPerUpdate) {
			this.callback(gameTime);
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
	private gameTime: GameTime;
	private gameCallbacks: Array<GameCallbackDriver>;
	private cpuSampler: SampleBuffer;
	private fpsSampler: SampleBuffer;
	private inputHandler: InputHandler;
	private input: Input;

	constructor(canvas: HTMLCanvasElement, device: GPUDevice, assets: AssetDatabase) {
		this.canvas = canvas;
		this.device = device;
		this.assets = assets;

		this.inputHandler = createInputHandler(window, canvas);

		const FIXED_UPDATE_HERTZ = 240;

		this.gameTime = {
			deltaSec: 0,
			fixedDeltaSec: 1.0 / FIXED_UPDATE_HERTZ,
			elapsedSec: 0,
			timeScale: 1.0,
		}

		this.gameState = new GameState();
		this.gameState.texture = createTextureFromImage(this.device, this.assets.getAsset("sculls_2").image);
		this.gameState.terrain = new Terrain();
		this.gameState.terrain.initFromHeightmap(this.device, this.assets.getAsset("heightmap").image);

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
			new GameCallbackDriver("Pre Frame", (gt: GameTime) => { this.preFrame(gt); }),
			new GameCallbackDriver("Update", (gt: GameTime) => { this.update(gt); }),
			new GameCallbackDriver("Fixed Update", (gt: GameTime) => { this.fixedUpdate(gt); }, FIXED_UPDATE_HERTZ),
			new GameCallbackDriver("Render", (gt: GameTime) => { this.render(gt); }),
			new GameCallbackDriver("Post Frame", (gt: GameTime) => { this.postFrame(gt); }),
		];

		requestAnimationFrame((timestamp) => { this.mainLoop(timestamp) });
	}

	private setCurrentTime(newTime: DOMHighResTimeStamp) {
		this.currentTime = newTime * 1000.0;
	}

	private preFrame(gameTime: GameTime) {

	}

	private update(gameTime: GameTime) {
	}

	private fixedUpdate(gameTime: GameTime) {
		this.gameState.state += gameTime.fixedDeltaSec;
	}

	private render(gameTime: GameTime) {
		this.renderer.draw(this.gameState);
	}

	private postFrame(gameTime: GameTime) {
	}

	private mainLoop(newTime: DOMHighResTimeStamp) {
		requestAnimationFrame((timestamp) => { this.mainLoop(timestamp) });

		const mainLoopStartTime = performance.now();

		if (!this.currentTime) {
			this.setCurrentTime(newTime);
		}

		const deltaTimeMicro = newTime * 1000 - this.currentTime;
		const deltaTime = deltaTimeMicro / 1000000;
		this.gameTime.deltaSec = deltaTime;
		this.gameTime.elapsedSec += deltaTime;

		console.log(this.input.axes.move_x);

		for (var callbackIndex in this.gameCallbacks) {
			var gameCb = this.gameCallbacks[callbackIndex]
			gameCb.update(this.gameTime);
		}

		this.setCurrentTime(newTime);

		if (deltaTime != 0) {
			this.fpsSampler.record(1 / deltaTime);
		}
		this.cpuSampler.record(performance.now() - mainLoopStartTime);

		debug.log(`FPS: ${(this.fpsSampler.slowAverage).toFixed(1)}`)
		debug.log(`CPU: ${(this.cpuSampler.average()).toFixed(3)}ms (Max ${(this.cpuSampler.max()).toFixed(3)}ms)`)
		debug.log(`GPU: ${(this.renderer.gpuSample.average() / 1000).toFixed(1)}μs (Max ${(this.renderer.gpuSample.max() / 1000).toFixed(1)}μs)`);
		debug.log(`Elapsed Time: ${this.gameTime.elapsedSec.toFixed(3)}s`);

		debug.flush();
	}
}
