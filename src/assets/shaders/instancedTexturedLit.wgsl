const MAX_LIGHTS = 2;

const modeAlbedoTexture = 0;
const modeNormalTexture = 1;
const modeNormalMap = 2;
const modeWeird = 3;
const modeSolidColor = 4;

struct Uniforms {
	viewMatrix: mat4x4f,
	projectionMatrix: mat4x4f,
	time: vec4f,
	cameraPosition: vec4f,
}

struct Light {
	position: vec4f,
	color: vec4f,
	diffuseScalar: f32,
	ambientScalar: f32,
	attenuation: f32,
}

struct LightingUniforms {
	lights: array<Light, MAX_LIGHTS>,
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
	@location(7) normalMatrix0: vec4f,
	@location(8) normalMatrix1: vec4f,
	@location(9) normalMatrix2: vec4f,
}

struct VertexOutput {
	@builtin(position) Position: vec4f,
	@location(0) uv: vec2f,
	@location(1) viewPosition: vec4f,
	@location(2) viewNormal: vec3f,
	@location(3) vertPosition: vec4f,
	@location(4) vertNormal: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<uniform> lighting: LightingUniforms;

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
		instance.normalMatrix0.xyz,
		instance.normalMatrix1.xyz,
		instance.normalMatrix2.xyz,
	);

	var modelViewMatrix = uniforms.viewMatrix * modelMatrix;
	var modelViewProjectionMatrix = uniforms.projectionMatrix * modelViewMatrix;

	let vertPosition = vec4f(vertex.position, 1.0);
	output.Position = modelViewProjectionMatrix * vertPosition;
	output.uv = vertex.uv;
	output.viewPosition = modelMatrix * vertPosition;
	output.viewNormal = normalMatrix * vertex.normal;
	output.vertPosition = vertPosition;
	output.vertNormal = vertex.normal;

	return output;
}

fn applyLight(
	light: Light,
	surfaceColor: vec3f,
	normal: vec3f,
	surfacePos: vec3f,
	surfaceToCamera: vec3f) -> vec3f
{
	let matSpecular = 1.0;
	let shininess = 0.3;
	let matSpecularColor = vec3f(shininess, shininess, shininess);

	var surfaceToLight: vec3f;
	var attenuation = 1.0;

	if (light.position.w == 0.0) {
		surfaceToLight = normalize(-light.position.xyz);
	}
	else {
		surfaceToLight = normalize(light.position.xyz - surfacePos);
		let distanceToLight = length(light.position.xyz - surfacePos);
		attenuation = 1.0 / (1.0 + light.attenuation * pow(distanceToLight, 2));
	}

	let ambient = light.ambientScalar * surfaceColor * light.color.rgb;
	let diffuseScalar = max(0.0, dot(normal, surfaceToLight)) * light.diffuseScalar;
	let diffuse = diffuseScalar * surfaceColor * light.color.rgb;

	var specularScalar = 0.0;
	if (diffuseScalar > 0.0) {
		specularScalar = pow(max(0.0, dot(surfaceToCamera, reflect(-surfaceToLight, normal))), matSpecular);
	}
	let specular = specularScalar * matSpecularColor * light.color.rgb;

	return ambient + attenuation * (diffuse + specular);
}

@fragment
fn fragment_main(
	input: VertexOutput
) -> @location(0) vec4f {
	let lights = array<Light, MAX_LIGHTS>();

	// let surfaceColor = ((input.vertPosition + 1) / 2).xyz;
	let surfaceColor = vec4f(1,0,1,1);

	var linearColor = vec3f(0);
	
	for (var i = 0; i < MAX_LIGHTS; i++) {
		var light = lighting.lights[i];
		linearColor += applyLight(
			light, 
			surfaceColor.rgb, 
			input.viewNormal, 
			input.viewPosition.xyz,
			normalize(uniforms.cameraPosition.xyz - input.viewPosition.xyz));
	}
    
	let gamma = vec3f(1.0/2.2);
    return vec4f(pow(linearColor, gamma), surfaceColor.a);
	// return surfaceColor;
	// return vec4f(linearColor, 1);
	// return vec4f(abs(input.vertNormal), 1);
}