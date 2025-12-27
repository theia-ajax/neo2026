import { UNIFORM_BIND_GROUP_LAYOUT_IDS, Uniforms, type UniformsDataStructure } from "@/render/uniforms";
import type { Vec4 } from "wgpu-matrix";
import type { Renderer } from "@/render/renderer";
import { createTextureBindGroup, createTextureFromImage } from "./texture";

export interface MaterialUniform extends UniformsDataStructure {

}

export interface DefaultMaterialUniform extends MaterialUniform {
	color: Vec4;
}

export const createMaterialUniform = (): MaterialUniform => ({
	color: {
		r: 0.5,
		g: 0,
		b: 1,
		a: 1,
	},
	specular: 500,
});

export type MaterialTextureMap = Partial<{
	diffuse: GPUTexture;
}>;

export type MaterialTextureTypes = keyof MaterialTextureMap;

export default class Material {
	name: string;
	uniforms: Uniforms<MaterialUniform>;
	textures: MaterialTextureMap = {};
	textureBindGroup?: GPUBindGroup;

	renderer: Renderer;
	renderPipeline: GPURenderPipeline;

	constructor(
		name: string,
		renderer: Renderer,
		renderPipeline: GPURenderPipeline,
	) {
		this.name = name;
		this.renderer = renderer;
		this.renderPipeline = renderPipeline;
		const bindGroupLayout = this.renderPipeline.getBindGroupLayout(UNIFORM_BIND_GROUP_LAYOUT_IDS["material"]);
		this.uniforms = new Uniforms("Material", renderer, createMaterialUniform(), bindGroupLayout);
	}

	public get device() { return this.renderer.device; }

	public addTexture(
		image: ImageBitmap,
		sampler: GPUSampler,
		type: MaterialTextureTypes
	) {
		const texture = createTextureFromImage(this.device, image);
		this.textures[type] = texture;
		this.textureBindGroup = createTextureBindGroup(this.device, this.renderPipeline, texture, sampler);
	}
}