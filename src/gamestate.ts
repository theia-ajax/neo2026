import { type Mesh, type MeshRenderable } from '@/render/mesh'

export class GameState {
	public state: number = 0;
	public texture: GPUTexture;
	public renderMesh: MeshRenderable;
}
