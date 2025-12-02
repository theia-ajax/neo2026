import { GUI } from 'dat.gui';
import { mat4, vec3, type Mat4 } from 'wgpu-matrix';

import triangleVertWGSL from "@shaders/triangle.vert.wgsl?raw"
import redFragWGSL from "@shaders/red.frag.wgsl?raw"

import '@/style.css'

import {
	cubeVertexArray,
	cubeVertexSize,
	cubeUVOffset,
	cubePositionOffset,
	cubeVertexCount,
} from '@meshes/cube';

import basicVertWGSL from '@shaders/basic.vert.wgsl?raw'
import vertexPositionColorWGSL from '@shaders/vertexPositionColor.frag.wgsl?raw'

import { quitIfWebGPUNotAvailable } from "@/renderer/renderer_utils.ts"
import { initRenderer, Renderer } from "@/renderer/renderer.ts"
import * as debug from "@/debug/debug.ts"
import { GameState } from "@/gamestate.ts"

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


interface GameCallback {
    (deltaTime: number): void;
}

// interface FrameRequestCallback {
//     (time: DOMHighResTimeStamp): void;
// }

class GameCallbackDriver {
	public interval: number = 0;
	public callback: GameCallback;
	private accumulator: number = 0;
	private maxCallsPerUpdate: number = 10;

	constructor(callback: GameCallback, callsPerSecond: number = 0)
	{
		this.interval = (callsPerSecond > 0) ? 1.0 / callsPerSecond : 0;
		if (this.interval == 0) {
			this.maxCallsPerUpdate = 1;
		}
		this.callback = callback;
		this.accumulator = 0;
	}

	public update(deltaTime: number)
	{
		this.accumulator += deltaTime;
		var safetyValve = this.maxCallsPerUpdate;
		while (this.accumulator >= this.interval && safetyValve > 0) {
			var dt = this.interval > 0 ? this.interval : deltaTime;
			this.callback(dt);
			safetyValve--;
			this.accumulator -= this.interval;
		}
	}
}

class Game {
	private gameState: GameState;
	private currentTime: number = 0;
	private elapsedTime: number = 0;
	private gameCallbacks: Array<GameCallbackDriver>;
	private renderer: Renderer;

	constructor(renderer: Renderer) {
		this.gameState = new GameState();
		this.renderer = renderer;

		this.gameCallbacks = [
			new GameCallbackDriver((dt: number) => { this.update(dt); }, 0),
			new GameCallbackDriver((dt: number) => { this.fixedUpdate(dt); }, 60),
			new GameCallbackDriver((dt: number) => { this.render(dt); }, 0),
		];

		const settings = {
			showDebug: debug.getVisible(),
		};

		const gui = new GUI();
		gui.add(settings, 'showDebug').onChange(() => {
			debug.setVisible(settings.showDebug);
		});

		requestAnimationFrame((timestamp) => { this.mainLoop(timestamp) });
	}

	private setCurrentTime(newTime: DOMHighResTimeStamp) {
		this.currentTime = newTime * 1000.0;
	}

	private update(deltaTime: number) {
		debug.log(`Elapsed Time (seconds): ${this.elapsedTime}`);
		debug.flush();
	}
	
	private fixedUpdate(deltaTime: number) {
		this.gameState.state += deltaTime;
	}

	private render(deltaTime: number) {
		this.renderer.draw(this.gameState);
	}

	private mainLoop(newTime: DOMHighResTimeStamp) {
		requestAnimationFrame((timestamp) => { this.mainLoop(timestamp) });

		if (!this.currentTime) {
			this.setCurrentTime(newTime);
		}

		const deltaTime = (newTime * 1000 - this.currentTime) / 1000000;
		this.elapsedTime += deltaTime;

		for (var callbackIndex in this.gameCallbacks) {
			this.gameCallbacks[callbackIndex].update(deltaTime);
		}

		this.setCurrentTime(newTime);
	}
}
