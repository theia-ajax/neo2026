import { UNIFORM_BIND_GROUP_LAYOUT_IDS } from "./uniforms";

export function createTextureFromImage(device: GPUDevice, image: ImageBitmap): GPUTexture {
	const texture = device.createTexture({
		size: [image.width, image.height],
		format: 'rgba8unorm',
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
	});

	device.queue.copyExternalImageToTexture(
		{ source: image },
		{ texture: texture },
		[image.width, image.height]
	);

	return texture;
}

export function createTextureBindGroup(
	device: GPUDevice,
	pipeline: GPURenderPipeline,
	texture: GPUTexture,
	sampler: GPUSampler,
	groupIndex: number = UNIFORM_BIND_GROUP_LAYOUT_IDS["texture"]
): GPUBindGroup {
	const bindGroup = device.createBindGroup({
		label: "Textures",
		layout: pipeline.getBindGroupLayout(groupIndex),
		entries: [
			{ binding: 0, resource: sampler },
			{ binding: 1, resource: texture.createView() },
		]
	});
	return bindGroup;
}
