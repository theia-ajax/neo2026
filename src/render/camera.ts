import type { GameTime } from '@/game';
import type { GameState } from '@/gamestate';
import { type Mat4, type Vec3, type Vec4, mat4, vec3 } from 'wgpu-matrix';

export class Camera {
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
}

export interface CameraController {
	camera: Camera;
    update(gameState: GameState, gameTime: GameTime): void;
}

export class TankCameraController implements CameraController {
	activeCamera: Camera;

	constructor(camera?: Camera)
	{
		this.activeCamera = camera;
	}

	get camera() { return this.activeCamera; }
	set camera(activeCamera: Camera) { this.activeCamera = activeCamera; }

	update(gameState: GameState, gameTime: GameTime)
	{
		if (this.camera == undefined) {
			return;
		}


	}
}