import type { AssetDescriptor, AssetManifest } from "./assets/assetDatabase";

export const GlobalAssetManifest: AssetManifest = {
	assets: [
		{
			name: "heightmap",
			type: "IMAGE",
			url: new URL('textures/smallheightmap.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "largeheightmap",
			type: "IMAGE",
			url: new URL('textures/height.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "grass_1_diffuse",
			type: "IMAGE",
			url: new URL('textures/Color Maps/grass_1.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "grass_1_normal",
			type: "IMAGE",
			url: new URL('textures/Normal Maps/grass_1_normal.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "roots_1_diffuse",
			type: "IMAGE",
			url: new URL('textures/Color Maps/roots_1.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "roots_1_normal",
			type: "IMAGE",
			url: new URL('textures/Normal Maps/roots_1_normal.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "ceiling_1_diffuse",
			type: "IMAGE",
			url: new URL('textures/Color Maps/hl_office_complex_style_drop_ceiling_1.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "ceiling_1_normal",
			type: "IMAGE",
			url: new URL('textures/Normal Maps/hl_office_complex_style_drop_ceiling_1_normal.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},

		
	]
}