const modeAlbedoTexture = 0;
const modeNormalTexture = 1;
const modeNormalMap = 2;
const modeWeird = 3;
const modeSolidColor = 4;

struct Uniforms {
	modelMatrix: mat4x4f,
	viewMatrix: mat4x4f,
	projectionMatrix: mat4x4f,
	time: vec4f,
}

struct Lighting {
	viewLightPosition: vec3f,
	mode: u32,
	lightIntensity: f32,
	depthScale: f32,
	depthLayer: f32,
}

struct VertexInput {
	@location(0) position : vec3f,
	@location(1) normal: vec3f,
	@location(2) uv : vec2f,
	@location(3) tangent: vec3f,
	@location(4) bitangent: vec3f,
}

struct VertexOutput {
	@builtin(position) Position : vec4f,
	@location(0) uv : vec2f,
	@location(1) viewPosition : vec4f,
	@location(2) viewNormal : vec4f,
	@location(3) viewTangent : vec4f,
	@location(4) viewBitangent : vec4f,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var diffuseMap: texture_2d<f32>;
@group(0) @binding(3) var normalMap: texture_2d<f32>;

@vertex
fn vertex_main(
	input: VertexInput
) -> VertexOutput {
	var output : VertexOutput;

	var modelViewMatrix = uniforms.viewMatrix * uniforms.modelMatrix;
	var modelViewProjectionMatrix = uniforms.projectionMatrix * modelViewMatrix;

	var vertPos = vec4f(input.position, 1.0);

	let time = uniforms.time.x;
	let s = ((sin(time + input.position.x / 1) + cos(time + input.position.z / 1)) + 2) / 4;
	// vertPos.y += s;

	output.Position = modelViewProjectionMatrix * vertPos;
	output.viewPosition = modelViewMatrix * vertPos;
	output.viewNormal = modelViewMatrix * vec4(input.normal, 0);
	output.viewTangent = modelViewMatrix * vec4(input.tangent, 0);
	output.viewBitangent = modelViewMatrix * vec4(input.bitangent, 0);
	output.uv = input.uv / 1;
	return output;
}


@fragment
fn fragment_main(
	input: VertexOutput
) -> @location(0) vec4f {
	var light : Lighting = Lighting(
		vec3f(25, 50, 10),
		modeNormalMap,
		10000.0,
		1.0,
		1.0
	);
	
	var albedoSample = textureSample(diffuseMap, textureSampler, input.uv);
	var normalSample = textureSample(normalMap, textureSampler, input.uv);

	switch (light.mode) {
		case modeAlbedoTexture: {
			return albedoSample;
		}
		case modeNormalTexture: {
			return normalSample;
		}
		case modeWeird: {
			let diffuse = albedoSample.rgb;
			let intensity = (diffuse.r + diffuse.g + diffuse.b);
			let grey = vec3f(intensity, intensity, intensity);
			let color1 = vec3f(0, 0.2, 1.0) * grey;
			let color2 = vec3f(0.8, 1.5, 1.5) * grey;
			return vec4f(mix(color1, color2, uniforms.time.x * 0.5), 1.0);
		}
		case modeSolidColor: {
			return vec4f(0, 0, 1, 1);
		}
		default: {
			let tangentToView = mat3x3f(
				input.viewTangent.xyz,
				input.viewBitangent.xyz,
				input.viewNormal.xyz,
			);
			let viewToTangent = transpose(tangentToView);
			
			let tanNormal = normalSample.xyz * 2 - 1;
			let viewNormal = normalize(tangentToView * tanNormal);
			let viewFragToLight = light.viewLightPosition - input.viewPosition.xyz;
			let lightSqrDist = dot(viewFragToLight, viewFragToLight);
			let viewLightDir = viewFragToLight * inverseSqrt(lightSqrDist);
			let diffuseLight = light.lightIntensity * max(dot(viewLightDir, viewNormal.xyz), 0) / lightSqrDist;
			let diffuse = albedoSample.rgb * diffuseLight;
			return vec4f(diffuse, 1.0);
		}
	}
}
