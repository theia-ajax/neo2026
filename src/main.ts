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

class Game {
	private frame: number = 0;
	private framesThisSecond: number = 0;
	private framesPerSecond: number = 0;
	private elapsedSeconds: number = 0;
	private secondTimer: number = 0;
	private lastClock: number = 0;
	private renderer: Renderer;

	constructor(renderer: Renderer) {
		this.renderer = renderer;

		const settings = {
			showDebug: debug.getVisible(),
		};

		const gui = new GUI();
		gui.add(settings, 'showDebug').onChange(() => {
			debug.setVisible(settings.showDebug);
		});

		requestAnimationFrame((timestamp) => { this.mainLoop(timestamp) });
	}

	private mainLoop(timestamp) {
		const clock = window.performance.now() * 1000.0;
		const elapsed = (this.lastClock !== 0) ? clock - this.lastClock : 0;
		const deltaTime = elapsed / 1000000.0;
		this.lastClock = clock;
		this.secondTimer += deltaTime;
		if (this.secondTimer >= 1.0) {
			this.secondTimer -= 1.0;
			this.framesPerSecond = this.framesThisSecond;
			this.framesThisSecond = 0;
		}
		this.elapsedSeconds += deltaTime;
		this.renderer.draw(this.elapsedSeconds);
		this.framesThisSecond++;

		debug.log(`Frame: ${this.frame}`);
		debug.log(`FPS: ${this.framesPerSecond}`);
		debug.log(`Elapsed Time (seconds): ${this.elapsedSeconds}`);
		
		this.frame++;
		debug.flush();
		requestAnimationFrame((timestamp) => { this.mainLoop(timestamp) });
	}
}
