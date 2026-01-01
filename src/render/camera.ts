import * as debug from "@/debug/debug"

import type { GameTime } from '@/game';
import type { GameState } from '@/gamestate';
import { type Mat4, type Vec3, type Vec4, mat4, vec3 } from 'wgpu-matrix';
import { Mathx } from '@/core/mathx';
import { utils } from 'wgpu-matrix';

export type CameraControllerType = 'tank' | 'orbit';

export interface ICamera {
	matrix: Mat4,
	view: Mat4,
	right: Vec3,
	up: Vec3,
	backwards: Vec3,
	position: Vec3,
}

export class Camera implements ICamera {
	private matrix_ = mat4.identity();
	private readonly view_ = mat4.identity();
	private right_ = new Float32Array(this.matrix_.buffer, 4 * 0, 4);
	private up_ = new Float32Array(this.matrix_.buffer, 4 * 4, 4);
	private backwards_ = new Float32Array(this.matrix_.buffer, 4 * 8, 4);
	private position_ = new Float32Array(this.matrix_.buffer, 4 * 12, 4);

	get matrix() { return this.matrix_; }
	set matrix(m: Mat4) { mat4.copy(m, this.matrix_); }
	get view() { return this.view_; }
	set view(m: Mat4) { mat4.copy(m, this.view_); }
	get right() { return this.right_; }
	set right(v: Vec3) { vec3.copy(v, this.right_); }
	get up() { return this.up_; }
	set up(v: Vec3) { vec3.copy(v, this.up_); }
	get backwards() { return this.backwards_; }
	set backwards(v: Vec3) { vec3.copy(v, this.backwards_); }
	get position() { return this.position_; }
	set position(v: Vec3) { vec3.copy(v, this.position_); }

	lookAt(eye: Vec3, target: Vec3, up: Vec3) {
		mat4.lookAt(eye, target, up, this.matrix);
		mat4.invert(this.matrix, this.view);
	}

	viewNoTranslation() {
		let v = mat4.copy(this.view);
		v[12] = 0;
		v[13] = 0;
		v[14] = 0;
		return v;
	}
}

export interface ICameraController {
	camera: Camera;
	update(gameState: GameState, dt: number): void;
}

export class CameraController implements ICameraController, ICamera {
	activeCamera: Camera;
	lastMatrix: Mat4;

	get camera() { return this.activeCamera; }
	set camera(activeCamera: Camera) { this.activeCamera = activeCamera; }

	get matrix() { return this.camera?.matrix; }
	set matrix(m: Mat4) { if (this.camera) { this.camera.matrix = m; } }
	get view() { return this.camera?.view; }
	set view(m: Mat4) { if (this.camera) { this.camera.view = m; } }
	get right() { return this.camera?.right; }
	set right(v: Vec3) { if (this.camera) { this.camera.right = v; } }
	get up() { return this.camera?.up; }
	set up(v: Vec3) { if (this.camera) { this.camera.up = v; } }
	get backwards() { return this.camera?.backwards; }
	set backwards(v: Vec3) { if (this.camera) { this.camera.backwards = v; } }
	get position() { return this.camera?.position; }
	set position(v: Vec3) { if (this.camera) { this.camera.position = v; } }

	constructor(camera?: Camera) {
		this.activeCamera = camera;
		this.lastMatrix = mat4.identity();
	}

	update(gameState: GameState, dt: number) {
	}

	saveState() {
		mat4.copy(this.matrix, this.lastMatrix);
	}

	restoreState() {
		mat4.copy(this.lastMatrix, this.matrix);
	}
}

export class TankCameraController extends CameraController {
	moveSpeed: number = 2;
	turnRateDegrees: number = 85.0;

	private yaw = 0;
	private pitch = 0;
	private targetPitch: number = 0;

	constructor(camera?: Camera) {
		super(camera);
	}

	update(gameState: GameState, dt: number) {
		if (this.camera == undefined) {
			return;
		}

		this.saveState();

		const look: boolean = gameState.input.buttons.look > 0;

		if (look) {
			this.targetPitch = 45 * gameState.input.axes.move_z * Mathx.deg2Rad;
		}
		else {
			this.targetPitch = 0;
		}
		this.pitch = utils.lerp(this.pitch, this.targetPitch, 10 * gameState.time.deltaSec);

		const position = vec3.copy(this.position);

		this.yaw -= gameState.input.axes.turn * this.turnRateDegrees * Mathx.deg2Rad * dt;
		this.activeCamera.matrix = mat4.multiply(mat4.rotationY(this.yaw), mat4.rotationX(this.pitch));

		const velocity = vec3.create();
		vec3.addScaled(velocity, this.right, gameState.input.axes.move_x, velocity);
		vec3.addScaled(velocity, this.backwards, -gameState.input.axes.move_y, velocity);

		if (!look) {
			vec3.addScaled(velocity, this.up, gameState.input.axes.move_z, velocity);
		}

		let moveSpeed = this.moveSpeed;
		if (gameState.input.buttons.sprint > 0) moveSpeed *= 4;

		vec3.addScaled(position, velocity, moveSpeed * dt, this.position);

		this.activeCamera.view = mat4.invert(this.activeCamera.matrix);
	}
}

export class AutoOrbitCameraController extends CameraController {
	target: Vec3 = vec3.create(0, 0, 0);
	azimuth: number = 0;
	zenith: number = 45;
	distance: number = 50;
	orbitRate: number = 15;

	constructor(camera?: Camera) {
		super(camera)
	}

	update(gameState: GameState, dt: number) {
		if (this.camera == undefined) {
			return;
		}

		this.saveState();

		this.azimuth += this.orbitRate * dt;

		let theta = -this.azimuth * Mathx.deg2Rad;
		let phi = this.zenith * Mathx.deg2Rad;

		const ρ = this.distance;
		const sin_φ = Math.sin(phi);
		const cos_φ = Math.cos(phi);
		const sin_θ = Math.sin(theta);
		const cos_θ = Math.cos(theta);

		debug.log(`Azimuth: ${this.azimuth.toFixed(1)} Zenith: ${this.zenith.toFixed(1)}`);
		// debug.log(`ρ=${ρ}`);
		// debug.log(`θ=${theta.toFixed(3)} sin(θ)=${sin_θ.toFixed(3)} cos(θ)=${cos_θ.toFixed(3)}`);
		// debug.log(`φ=${phi.toFixed(3)} sin(φ)=${sin_φ.toFixed(3)} cos(φ)=${cos_φ.toFixed(3)}`);

		let eye = vec3.create(
			cos_θ * cos_φ * this.distance,
			sin_φ * this.distance,
			sin_θ * cos_φ * this.distance
		);
		const prettyVec3 = (v) => {
			return `${v[0].toFixed(3)}, ${v[1].toFixed(3)}, ${v[2].toFixed(3)}`
		}
		debug.log(`Eye: ${prettyVec3(eye)}`);

		vec3.add(this.target, eye, this.position);
		vec3.normalize(vec3.sub(eye, this.target), this.backwards);

		vec3.negate(vec3.create(-sin_θ, 0, cos_θ), this.right);

		// vec3.cross(basisVector, this.backwards, this.right);
		vec3.cross(this.backwards, this.right, this.up);

		// this.activeCamera.matrix = mat4.translate(mat4.lookAt(eye, this.target, up), eye);
		this.activeCamera.view = mat4.inverse(this.activeCamera.matrix);
	}
}