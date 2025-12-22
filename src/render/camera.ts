import type { GameTime } from '@/game';
import type { GameState } from '@/gamestate';
import { type Mat4, type Vec3, type Vec4, mat4, vec3 } from 'wgpu-matrix';
import { Mathx } from '@/core/mathx';

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

	lookAt(eye: Vec3, target: Vec3, up: Vec3)
	{
		mat4.lookAt(eye, target, up, this.matrix);
		mat4.invert(this.matrix, this.view);
	}
}

export interface ICameraController {
	camera: Camera;
	update(gameState: GameState, dt: number): void;
}

export class CameraController implements ICameraController, ICamera {
	activeCamera: Camera;

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

	constructor(camera?: Camera) { this.activeCamera = camera; }
	update(gameState: GameState, dt: number) { }
}

export class TankCameraController extends CameraController {
	private yaw = 0;

	moveSpeed: number = 25;
	turnRateDegrees: number = 85.0; 

	constructor(camera?: Camera) {
		super(camera);
	}

	update(gameState: GameState, dt: number) {
		if (this.camera == undefined) {
			return;
		}

		const position = vec3.copy(this.position);

		this.yaw -= gameState.input.axes.turn * this.turnRateDegrees * Mathx.deg2Rad * dt;
		this.activeCamera.matrix = mat4.rotationY(this.yaw);

		const velocity = vec3.create();
		vec3.addScaled(velocity, this.right, gameState.input.axes.move_x, velocity);
		vec3.addScaled(velocity, this.backwards, -gameState.input.axes.move_y, velocity);
		vec3.addScaled(velocity, this.up, gameState.input.axes.move_z, velocity);

		let moveSpeed = this.moveSpeed;
		if (gameState.input.buttons.sprint > 0) moveSpeed *= 2;

		vec3.addScaled(position, velocity, moveSpeed * dt, this.position);

		this.activeCamera.view = mat4.invert(this.activeCamera.matrix);
	}
}