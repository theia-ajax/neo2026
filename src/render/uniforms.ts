import { Renderer } from "@/render/renderer"

const isObject = (value: any) =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const isArray = (value: any) =>
	typeof value === "object" && Array.isArray(value);

export const isObjOrArray = (value: any) => {
	const checkObject = isObject(value);
	const checkArray = isArray(value);

	return checkObject ? "object" : checkArray ? "array" : "other";
};

export const UNIFORM_BIND_GROUP_LAYOUT_IDS = {
	globals: 0,
	locals: 1,
	material: 2,
	texture: 3,
};

type UniformPrimitiveDataTypes = number | boolean;

type UniformDataTypes =
	| UniformPrimitiveDataTypes
	| UniformPrimitiveDataTypes[]
	| Float32Array<ArrayBufferLike>
	| Record<string, UniformPrimitiveDataTypes>;
export type UniformsDataStructure = Record<string, UniformDataTypes>;

export function getUniformSize(uniform: any) {
	if (isObject(uniform)) {
		return Object.keys(uniform).length * 4;
	} else if (isArray(uniform)) {
		return (uniform as Array<any>).length * 4;
	} else {
		return 4;
	}
}

export function getUniformsObjectAlignment<UniformsObject extends UniformsDataStructure>(uniforms: UniformsObject) {
	let alignment = 0;
	for (const key in uniforms) {
		const uniform = uniforms[key];

		let size = getUniformSize(uniform);
		if (size > alignment) {
			if (size <= 4) {
				alignment = 4;
			} else if (size <= 8) {
				alignment = 8;
			} else {
				alignment = 16;
			}
		}
	}
	return alignment;
}

export function getUniformsObjectSizeAndMapping<UniformsObject extends UniformsDataStructure>(uniforms: UniformsObject)
	: [number, Record<keyof UniformsObject, number>] {
	let requiredAlignment = getUniformsObjectAlignment(uniforms);
	let sizeInBytes = 0;
	let mapping = {} as Record<keyof UniformsObject, number>;
	for (const key in uniforms) {
		const uniform = uniforms[key];
		mapping[key] = sizeInBytes;
		sizeInBytes += getUniformSize(uniform);
		sizeInBytes += (requiredAlignment - (sizeInBytes % requiredAlignment)) % requiredAlignment;
	}
	return [sizeInBytes, mapping];
}

export function convertUniformPrimitiveToNumber(value: UniformPrimitiveDataTypes): number {
	switch (typeof value) {
		case 'boolean': return Number(value);
		case 'number': return value as number;
		default: throw new Error('Invalid UniformPrimitive');
	}
}

export class Uniforms<UniformsObject extends UniformsDataStructure> {
	name: string;
	uniforms: UniformsObject;
	mapping: Record<keyof UniformsObject, number>;
	gpuBuffer!: GPUBuffer;
	gpuBindGroup!: GPUBindGroup;
	uniformValues!: Float32Array;
	renderer!: Renderer;
	gpuBufferIsDirty: boolean;

	constructor(
		name: string,
		renderer: Renderer,
		uniforms: UniformsObject,
		bindGroupLayout: GPUBindGroupLayout,
		additionalBindings?: GPUBindGroupEntry[]
	) {
		this.name = name;
		this.renderer = renderer;
		this.uniforms = uniforms;

		const [sizeInBytes, mapping] = getUniformsObjectSizeAndMapping(this.uniforms);
		this.mapping = mapping;
		this.gpuBuffer = this.device.createBuffer({
			label: `${this.name} Uniform`,
			size: sizeInBytes,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.uniformValues = new Float32Array(sizeInBytes / 4);

		this.gpuBindGroup = this.device.createBindGroup({
			label: `${this.name} Uniform Bind Group`,
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.gpuBuffer,
					}
				},
				...additionalBindings,
			],
		});
	}

	private get device() { return this.renderer.getDevice(); }

	public updateUniforms() {
		for (const key in this.uniforms) {
			const uniform = this.uniforms[key];

			let data: number[] = null;

			if (isObject(uniform)) {
				const values = Object.values(uniform);
				const parsedValues = values.map(convertUniformPrimitiveToNumber);
				data = [...parsedValues];
			} else if (isArray(uniform)) {
				const parsedValues = (uniform as UniformPrimitiveDataTypes[]).map(convertUniformPrimitiveToNumber);
				data = [...parsedValues];
			} else {
				data = [
					convertUniformPrimitiveToNumber(uniform as UniformPrimitiveDataTypes),
				];
			}

			this.uniformValues.set(data, this.mapping[key]);
		}

		this.device.queue.writeBuffer(this.gpuBuffer, 0, this.uniformValues.buffer);
	}
}