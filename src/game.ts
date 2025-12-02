import { GUI } from "dat.gui"
import * as debug from "@/debug/debug"
import { GameState } from "@/gamestate"
import { Renderer } from "@/render/renderer"
import { SampleBuffer } from "@/util"

interface GameCallback {
	(deltaTime: number): void;
}

// interface FrameRequestCallback {
//     (time: DOMHighResTimeStamp): void;
// }

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

	public update(deltaTime: number) {
		deltaTime = Math.min(deltaTime, 1.0);
		this.accumulator += deltaTime;
		this.accumulator = Math.min(this.accumulator, this.maxCallsPerUpdate * this.interval);
		var callsThisUpdate = 0;
		while (this.accumulator >= this.interval && callsThisUpdate < this.maxCallsPerUpdate) {
			var dt = this.interval > 0 ? this.interval : deltaTime;
			this.callback(dt);
			this.accumulator -= this.interval;
			callsThisUpdate++;
		}
		this.numCallsLastUpdate = callsThisUpdate;
	}

	public get callsLastUpdate() { return this.numCallsLastUpdate; }
}

export class Game {
	private gameState: GameState;
	private currentTime: number = 0;
	private elapsedTime: number = 0;
	private gameCallbacks: Array<GameCallbackDriver>;
	private renderer: Renderer;
	private cpuSampler: SampleBuffer;
	private fpsSampler: SampleBuffer;

	constructor(renderer: Renderer) {
		this.cpuSampler = new SampleBuffer(60);
		this.fpsSampler = new SampleBuffer(60);

		this.gameState = new GameState();
		this.renderer = renderer;

		this.gameCallbacks = [
			new GameCallbackDriver("Pre Frame", (dt: number) => { this.preFrame(dt); }, 0),
			new GameCallbackDriver("Update", (dt: number) => { this.update(dt); }, 0),
			new GameCallbackDriver("Fixed Update", (dt: number) => { this.fixedUpdate(dt); }, 240),
			new GameCallbackDriver("Render", (dt: number) => { this.render(dt); }, 0),
			new GameCallbackDriver("Post Frame", (dt: number) => { this.postFrame(dt); }, 0),
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

	private preFrame(deltaTime: number) {

	}

	private update(deltaTime: number) {
	}

	private fixedUpdate(deltaTime: number) {
		this.gameState.state += deltaTime;
	}

	private render(deltaTime: number) {
		this.renderer.draw(this.gameState);
	}

	private postFrame(deltaTime: number) {
	}

	private mainLoop(newTime: DOMHighResTimeStamp) {
		requestAnimationFrame((timestamp) => { this.mainLoop(timestamp) });

		const mainLoopStartTime = performance.now();

		if (!this.currentTime) {
			this.setCurrentTime(newTime);
		}

		const deltaTimeMicro = newTime * 1000 - this.currentTime;
		const deltaTime = deltaTimeMicro / 1000000;
		this.elapsedTime += deltaTime;

		for (var callbackIndex in this.gameCallbacks) {
			var gameCb = this.gameCallbacks[callbackIndex]
			gameCb.update(deltaTime);
		}

		this.setCurrentTime(newTime);

		if (deltaTime != 0) {
			this.fpsSampler.record(1 / deltaTime);
		}
		this.cpuSampler.record(performance.now() - mainLoopStartTime);

		debug.log(`FPS: ${(this.fpsSampler.slowAverage).toFixed(1)}`)
		debug.log(`CPU: ${(this.cpuSampler.average()).toFixed(3)}ms (Max ${(this.cpuSampler.max()).toFixed(3)}ms)`)
		debug.log(`GPU: ${(this.renderer.gpuSample.average() / 1000).toFixed(1)}μs (Max ${(this.renderer.gpuSample.max() / 1000).toFixed(1)}μs)`);
		debug.log(`Elapsed Time: ${this.elapsedTime.toFixed(3)}s`);

		debug.flush();
	}
}
