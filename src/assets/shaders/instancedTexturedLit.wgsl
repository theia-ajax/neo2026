const MAX_LIGHTS = 16;

const modeAlbedoTexture = 0;
const modeNormalTexture = 1;
const modeNormalMap = 2;
const modeWeird = 3;
const modeSolidColor = 4;

struct Uniforms {
	viewMatrix: mat4x4f,
	projectionMatrix: mat4x4f,
	time: vec4f,
}

// struct PointLight {
// 	position: vec4f,
// 	color: vec4f,
// 	intensity: f32,
// 	range: f32,
// }

// struct LightingUniforms {
// 	ambientColor: vec4f,
// 	globalDirection: vec4f,
// 	globalColor: vec4f,
// 	lights: array<PointLight, MAX_LIGHTS>,
// }

struct VertexInput {
	@location(0) position: vec3f,
	@location(1) normal: vec3f,
	@location(2) uv: vec2f
}

struct InstanceInput {
	@location(3) modelMatrix0: vec4f,
	@location(4) modelMatrix1: vec4f,
	@location(5) modelMatrix2: vec4f,
	@location(6) modelMatrix3: vec4f,
}

struct VertexOutput {
	@builtin(position) Position: vec4f,
	@location(0) normal: vec4f,
	@location(1) uv: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// @group(1) @binding(0) var textureSampler: sampler;
// @group(1) @binding(1) var diffuseMap: texture_2d<f32>;

@vertex
fn vertex_main(
	vertex: VertexInput,
	instance: InstanceInput,
) -> VertexOutput
{
	var output: VertexOutput;

	let modelMatrix = mat4x4f(
		instance.modelMatrix0,
		instance.modelMatrix1,
		instance.modelMatrix2,
		instance.modelMatrix3,
	);


	var modelViewProjectionMatrix = uniforms.projectionMatrix * uniforms.viewMatrix * modelMatrix;

	output.Position = modelViewProjectionMatrix * vec4f(vertex.position, 1.0);
	output.normal = vec4f(vertex.normal, 1.0);
	output.uv = vertex.uv;

	return output;
}

@fragment
fn fragment_main(
	input: VertexOutput
) -> @location(0) vec4f {
	return vec4f(1, 0, 0, 1);
}