import { type Mesh, type MeshRenderable } from '@/render/mesh'
import type { Terrain } from '@/terrain';
import type { Vec3 } from 'wgpu-matrix';
import type { GameTime } from '@/game';
import type { Camera, TankCameraController } from '@/render/camera';
import type Input from '@/input';

export class GameState {
	public time: GameTime;
	public camera: Camera;
	public cameraController: TankCameraController;
	public input: Input;
	public terrain: Terrain;
	public texture: GPUTexture;
	public renderMesh: MeshRenderable;
}
