import type { World } from "@dimforge/rapier3d";

type RAPIER_API = typeof import("@dimforge/rapier3d");

export class Physics {
	RAPIER: RAPIER_API;
	world: World;
	worldStep: () => void;

	constructor(RAPIER: RAPIER_API) {
		let gravity = { x: 0, y: -9.81, z: 0.0 };
		let world = new RAPIER.World(gravity);

		const baseHeight = 27;
		let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.01, 10.0).setTranslation(0, baseHeight, 0);
		world.createCollider(groundColliderDesc);


		const count = 12;

		for (var y = 0; y < count; y++) {


			for (var x = 0; x < y; x++) {
				var nx = x / y;
				for (var z = 0; z < y; z++) {
					var nz = z / y;
					let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
						(nx - 0.5) * y * 1.2, 5.0 + y + baseHeight, (nz - 0.5) * y * 1.2);
					let rigidBody = world.createRigidBody(rigidBodyDesc);

					let colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
					let collider = world.createCollider(colliderDesc, rigidBody);
				}
			}
		}

		this.world = world;

		this.worldStep = () => {
			this.world.step();
		}
	}

	step() {
		this.worldStep();
	}

	get debugRender() { return this.world.debugRender(); }
}