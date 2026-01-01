import type { World, Vector3 } from "@dimforge/rapier3d";
import { RawIntegrationParameters, RawVector } from "@dimforge/rapier3d/rapier_wasm3d";
import { type Vec3, type Quat, vec3, mat4, mat3, quat } from 'wgpu-matrix'
import type { Renderer } from "@/render/renderer";
import RAPIER from "@dimforge/rapier3d";

type RAPIER_API = typeof import("@dimforge/rapier3d");

export interface PhysicsIntegrationParameters {
	dt?: number;
}

export interface PhysicsParameters {
	integration?: PhysicsIntegrationParameters,
}

const createIntegrationParameters = (RAPIER: RAPIER_API, param?: PhysicsIntegrationParameters) => {
	let rawIntegration = new RawIntegrationParameters();
	rawIntegration.dt = param?.dt ?? 1.0 / 60.0;
	return rawIntegration;
}

export class Physics {
	RAPIER: RAPIER_API;
	world: World;
	params: PhysicsParameters;

	constructor(RAPIER: RAPIER_API, params?: PhysicsParameters) {
		this.RAPIER = RAPIER;
		this.params = params;
		
		this.resetWorld();
	}
	
	resetWorld()
	{
		const RAPIER = this.RAPIER;

		if (this.world) {
			this.world.free();
			this.world = undefined;
		}
		
		let params = this.params;
		let gravity = new RAPIER.Vector3(0, -9.81, 0.0);
		let world = new RAPIER.World(gravity, createIntegrationParameters(RAPIER, params?.integration));
		this.world = world;
		this.spawnColliders();
	}
	
	spawnColliders()
	{
		const RAPIER = this.RAPIER;

		const baseHeight = 10;
	
		const count = 12;
		const spacing = 1.1;
	
		for (var y = 4; y < count; y++) {
			for (var x = 0; x < y; x++) {
				var nx = x / y;
				for (var z = 0; z < y; z++) {
					var nz = z / y;
					let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
						(nx - 0.5) * y * spacing, 5.0 + y * spacing + baseHeight, (nz - 0.5) * y * spacing);
					let rigidBody = this.world.createRigidBody(rigidBodyDesc);
	
					const size = 0.5;
					let colliderDesc = RAPIER.ColliderDesc.cuboid(size, size, size);
					let collider = this.world.createCollider(colliderDesc, rigidBody);
				}
			}
		}
	}



	step() {
		this.world.step();
	}

	get debugRender() { return this.world.debugRender(); }

	getBodyModelMatrices() {

	}

	createHeightField(imageData: ImageData) {
		let heights = [];
		for (let x = 0; x < imageData.width; x++) {
			for (let y = 0; y < imageData.height; y++) {
				const idx = (x + y * imageData.width) * 4;
				const r = imageData.data[idx + 0];
				const g = imageData.data[idx + 1];
				const b = imageData.data[idx + 2];
				const value = (r + g + b) / 255 / 3;
				heights.push(value);
			}
		}
		return new Float32Array(heights);
	}

	createHeightmapCollider(imageData: ImageData, scale: Vec3) {
		const RAPIER = this.RAPIER;
		const world = this.world;

		const sw = ((imageData.width - 1) * scale[0]);
		const sh = ((imageData.height - 1) * scale[2]);

		let hmScale = new RAPIER.Vector3(sw, scale.at(1), sh);
		let hmBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
		let hmBody = world.createRigidBody(hmBodyDesc);
		let heights = this.createHeightField(imageData);
		let hmColliderDesc = RAPIER.ColliderDesc.heightfield(imageData.width - 1, imageData.height - 1, heights, hmScale);
		try {
			world.createCollider(hmColliderDesc, hmBody);
		}
		catch (err) {
			console.error(err);
		}
	}

	public renderColliders(renderer: Renderer) {
		this.internalRenderColliders(this.RAPIER, renderer);
	}

	private internalRenderColliders(RAPIER: RAPIER_API, renderer: Renderer) {
		const V3 = (v) => {
			return vec3.create(v.x, v.y, v.z);
		}

		const Q = (q) => {
			return quat.create(q.x, q.y, q.z, q.w);
		}

		var objects = []

		this.world.forEachCollider((collider) => {
			if (collider.shapeType() == RAPIER.ShapeType.Cuboid) {
				var scale = V3(collider.halfExtents());
				var rotation = Q(collider.rotation());
				var translation = V3(collider.translation());

				var model = mat4.identity();

				var matR = mat4.fromQuat(rotation);
				var matS = mat4.scale(mat4.identity(), scale);
				var matT = mat4.translate(model, translation);

				var model = mat4.mul(matT, mat4.mul(matS, matR));

				objects.push({modelMatrix: model});
			}
		});

		renderer.setObjectInstances(objects);
	}
}