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
	invViewMatrix: mat3x3f,
}

struct PointLight {
	position: vec4f,
	color: vec4f,
	intensity: f32,
	range: f32,
}

struct LightingUniforms {
	ambientColor: vec4f,
	globalDirection: vec3f,
	globalColor: vec4f,
	lights: array<PointLight, MAX_LIGHTS>,
}

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
	@location(7) normalMatrix0: vec3f,
	@location(8) normalMatrix1: vec3f,
	@location(9) normalMatrix2: vec3f,
}

struct VertexOutput {
	@builtin(position) Position: vec4f,
	@location(0) uv: vec2f,
	@location(1) viewPosition: vec4f,
	@location(2) viewNormal: vec3f,
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

	let normalMatrix = mat3x3f(
		instance.normalMatrix0,
		instance.normalMatrix1,
		instance.normalMatrix2,
	);

	var modelViewMatrix = uniforms.viewMatrix * modelMatrix;
	var modelViewProjectionMatrix = uniforms.projectionMatrix * uniforms.viewMatrix * modelMatrix;

	let vertPosition = vec4f(vertex.position, 1.0);
	output.Position = modelViewProjectionMatrix * vertPosition;
	output.uv = vertex.uv;
	output.viewPosition = modelMatrix * vertPosition;
	output.viewNormal = normalMatrix * vertex.normal;

	return output;
}

@fragment
fn fragment_main(
	input: VertexOutput
) -> @location(0) vec4f {
	let lights = array<PointLight, MAX_LIGHTS>();
	let lighting: LightingUniforms = LightingUniforms(
		vec4f(0, 0, 0, 1.0),
		normalize(vec3f(0.2, 3, 0.4)),
		vec4f(1, 1, 1, 1),
		lights
	);

	let color = vec4f(0.9, 0.0, 1.0, 1.0);

	let lightDir = normalize(lighting.globalDirection - input.viewPosition.xyz);

	let diffuseIntensity = max(dot(lightDir, input.viewNormal), 0);

	let ambient = lighting.ambientColor * color;
	let diffuse = color * diffuseIntensity;

	return ambient + diffuse;

	// return color;
}