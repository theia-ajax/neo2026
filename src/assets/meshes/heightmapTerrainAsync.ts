import type { Mesh } from "@/render/mesh"
import { type CreateHeightmapTerrainOptions } from "@/assets/meshes/heightmapTerrain"

interface TerrainWorker {
	id: number;
	onComplete: (mesh: Mesh) => void;
	onProgress: (progress: number) => void;
}

let nextWorkerId = 1;
const activeWorkers = new Array<TerrainWorker>();
const worker = new Worker(
	new URL('@/workers/heightmapWorker.ts', import.meta.url), { type: 'module' });

worker.onmessage = (e) => {
	const id: number = e.data.id;
	const workerIndex = activeWorkers.findIndex((w) => { return w.id == id; });
	console.assert(workerIndex >= 0);

	const worker = activeWorkers[workerIndex];

	if (e.data.mesh) {
		worker.onComplete(e.data.mesh);
		activeWorkers.splice(workerIndex, 1);
	}
	else if (worker.onProgress !== undefined && e.data.progress) {
		worker.onProgress(e.data.progress);
	}
}

export function createTerrainMeshFromHeightmapAsync(
	heightmapData: ImageData,
	options: CreateHeightmapTerrainOptions,
	onComplete: (mesh: Mesh) => void,
	onProgress?: (progress: number) => void) {

	const workerId = nextWorkerId++;
	const startTime = performance.now();

	activeWorkers.push({
		id: workerId,
		onComplete: (mesh) => {
			const duration = (performance.now() - startTime) / 1000.0;
			console.log(`Terrain generation took ${duration.toFixed(3)} seconds`);
			onComplete(mesh);
		},
		onProgress: onProgress,
	});

	worker.postMessage({
		id: workerId,
		image: heightmapData,
		options: options,
	})
}