import type { World, Vector3 } from "@dimforge/rapier3d";
import { RawIntegrationParameters } from "@dimforge/rapier3d/rapier_wasm3d";
import { type Vec3 } from 'wgpu-matrix'

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

	constructor(RAPIER: RAPIER_API, param?: PhysicsParameters) {
		this.RAPIER = RAPIER;
		let gravity = new RAPIER.Vector3(0, -9.81, 0.0);
		let world = new RAPIER.World(gravity, createIntegrationParameters(RAPIER, param?.integration));
		this.world = world;

		const baseHeight = 4;
		// let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.01, 10.0).setTranslation(0, baseHeight, 0);
		// world.createCollider(groundColliderDesc);


		const count = 20;
		const spacing = 1.4;

		for (var y = count - 2; y < count; y++) {


			for (var x = 0; x < y; x++) {
				var nx = x / y;
				for (var z = 0; z < y; z++) {
					var nz = z / y;
					let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
						(nx - 0.5) * y * spacing, 5.0 + y * spacing + baseHeight, (nz - 0.5) * y * spacing);
					let rigidBody = world.createRigidBody(rigidBodyDesc);

					let colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
					let collider = world.createCollider(colliderDesc, rigidBody);
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
}