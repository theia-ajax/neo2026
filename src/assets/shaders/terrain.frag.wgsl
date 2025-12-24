@group(0) @binding(1) var fragSampler: sampler;
@group(0) @binding(2) var diffuseMap: texture_2d<f32>;
@group(0) @binding(3) var normalMap: texture_2d<f32>;

@fragment
fn main(
	@location(0) fragUV: vec2f,
	@location(1) fragPosition: vec4f,
	@location(2) fragNorm: vec4f
) -> @location(0) vec4f {
	var textureColor: vec4f = textureSample(diffuseMap, fragSampler, fragUV);
	var normalColor = textureSample(normalMap, fragSampler, fragUV);
	// return textureColor;
	var color = textureColor;
	// return mix(vec4f(0, 0.0, 0.0, 1), color, fragPosition.y);
	var uv = fragUV/8;
	// return vec4f(uv.x, 0.0, uv.y, 1.0);
	var prod = dot(fragNorm + normalColor, normalize(vec4f(1.1, 0.8, 0.4, 1)));
	var baseColor = color * prod;
	
	return mix(vec4f(0,0.1,0.1,1), baseColor, clamp((fragPosition.y - 6)/8,0,1));
	// return normalColor;
}
