struct VertexOut {
	@builtin(position) position: vec4f,
	@location(0) worldPosition: vec3<f32>,
	@location(1) color : vec4f,
	@location(2) normal : vec3f,
	@location(3) uv : vec2f,
	@location(4) lightDirection: vec3f,
	@location(5) surfaceToView: vec3f,
}

struct GlobalUniforms {
	time: f32,
	lightPosition: vec3<f32>,
}

struct CameraUniforms {
	viewMatrix: mat4x4<f32>,
	projectionMatrix: mat4x4<f32>,
}

struct MaterialUniforms {
	color: vec4f,
}

@group(0) @binding(0) var<uniform> globals: GlobalUniforms;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> modelMatrix: mat4x4<f32>;
@group(2) @binding(0) var<uniform> material: MaterialUniforms;
@group(3) @binding(0) var fragSampler: sampler;
@group(3) @binding(1) var fragTexture: texture_2d<f32>;

@vertex
fn vertex_main(
	@builtin(vertex_index) vertexIndex: u32,
	@builtin(instance_index) instanceIndex: u32,
	@location(0) position: vec3f,
	@location(1) normal: vec3f,
	@location(2) uv: vec2f
) -> VertexOut
{
	var output: VertexOut;

	let worldPosition = modelMatrix * vec4<f32>(position, 1.0);
	output.position = camera.projectionMatrix * camera.viewMatrix * worldPosition;
	output.worldPosition = worldPosition.xyz;
	output.color = material.color;
	output.normal = normal;
	output.uv = uv;

	return output;
}

@fragment
fn fragment_main(frag: VertexOut) -> @location(0) vec4f
{
	let textureColor = textureSample(fragTexture, fragSampler, frag.uv);
	return textureColor * frag.color;	
}