import type { AssetDescriptor, AssetManifest } from "./assets/assetDatabase";

export const GlobalAssetManifest: AssetManifest = {
	assets: [
		{
			name: "testimage",
			type: "IMAGE",
			url: new URL('textures/testimage.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "sculls_2",
			type: "IMAGE",
			url: new URL('textures/sculls_2.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "heightmap",
			type: "IMAGE",
			url: new URL('textures/heightmap.png', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
		{
			name: "smallheightmap",
			type: "IMAGE",
			url: new URL('textures/smallheightmap.jpg', import.meta.url),
			importConfig: {
				type: "IMAGE",
				textureFormat: 'rgba8unorm',
			}
		},
	]
}