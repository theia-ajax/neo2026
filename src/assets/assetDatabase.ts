
export type AssetType = "IMAGE";


type ImageAssetImportConfig = {
	type: "IMAGE";
	textureFormat?: GPUTextureFormat;
	textureMipLevelCount?: GPUIntegerCoordinate;
	textureSampleCount?: GPUSize32;
	textureDimension?: GPUTextureDimension;
}

type AssetImportConfig =
	| ImageAssetImportConfig;

export interface AssetDescriptor {
	name: string;
	type: AssetType;
	url: URL;
	importConfig: AssetImportConfig;
}

export interface AssetManifest {
	assets: Array<AssetDescriptor>;
}

type ImageAsset = {
	type: "IMAGE";
	image: ImageBitmap;
	texture?: GPUTexture;
}

type Asset =
	| ImageAsset;

export async function initAssetDatabase(manifest: AssetManifest, device: GPUDevice) {
	console.log("Creating AssetDatabase");
	var assetDatabase = new AssetDatabase();
	await assetDatabase.loadManifest(manifest, device);
	return assetDatabase;
}

interface AssetOnLoadCallback {
	(asset: Asset, descriptor: AssetDescriptor): void;
}

interface AssetLoadCallback {
	(descriptor: AssetDescriptor): Promise<Asset>;
}


function imageAssetCreateTexture(asset: ImageAsset, descriptor: AssetDescriptor, device: GPUDevice) {
	asset.texture = device.createTexture({
		size: [asset.image.width, asset.image.height],
		format: descriptor.importConfig.textureFormat,
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
		mipLevelCount: descriptor.importConfig.textureMipLevelCount,
		sampleCount: descriptor.importConfig.textureSampleCount,
		dimension: descriptor.importConfig.textureDimension,
	});
	device.queue.copyExternalImageToTexture(
		{ source: asset.image },
		{ texture: asset.texture },
		[asset.image.width, asset.image.height]);
}

async function loadImageAsset(descriptor: AssetDescriptor): Promise<ImageAsset> {
	const asset: ImageAsset = {
		type: "IMAGE",
		image: null,
	};

	const response = await fetch(descriptor.url);
	asset.image = await createImageBitmap(await response.blob());

	return asset;
}

function onImageAssetLoaded(asset: Asset, descriptor: AssetDescriptor) {
	console.log("onImageAssetLoaded");

}

const assetLoaders = {
	IMAGE: { load: loadImageAsset, onLoad: onImageAssetLoaded },
};

export class AssetDatabase {
	assets: Map<string, Asset> = new Map<string, Asset>();

	public async loadManifest(manifest: AssetManifest, device: GPUDevice) {
		for (var index in manifest.assets) {
			const descriptor = manifest.assets[index];

			if (this.assets.has(descriptor.name)) {
				throw new Error(`Asset named ${descriptor.name} already exists in AssetDatabase!`);
			}

			console.log(`Beginning load of asset ${descriptor.name}`);

			if (assetLoaders[descriptor.type] === undefined) {
				throw new Error(`No loader found for type ${descriptor.type}.`);
			}

			let { load, onLoad } = assetLoaders[descriptor.type];
			await this.loadAsset(descriptor, load, onLoad);
		}
	}

	public getAsset(name: string): Asset {
		return this.assets.get(name);
	}

	private onAssetLoaded(asset: Asset, descriptor: AssetDescriptor, onLoaded: AssetOnLoadCallback) {
		this.assets.set(descriptor.name, asset);
		if (onLoaded) {
			onLoaded(asset, descriptor);
		}
	}

	private async loadAsset(descriptor: AssetDescriptor, loadAsset: AssetLoadCallback, onLoad: AssetOnLoadCallback) {
		await (async () => {
			try {
				const asset = await loadAsset(descriptor);
				this.onAssetLoaded(asset, descriptor, onLoad);
			} catch (error) {
				console.error(`Unable to load manifest asset ${descriptor.name} @ ${descriptor.url}.`);
			}
		})();
	}

	// private async loadImage(descriptor: AssetDescriptor, onImageLoaded: AssetOnLoadCallback) {
	// 	this.assets.set(descriptor.name, {
	// 		type: "IMAGE",
	// 		image: null,
	// 	});

	// 	const response = await fetch(resolveAssetPath(descriptor.path));
	// 	const imageBitmap = await createImageBitmap(await response.blob());

	// 	var imageAsset = this.assets.get(descriptor.name);
	// 	imageAsset.image = imageBitmap;
	// 	this.onAssetLoaded(imageAsset, descriptor, onImageLoaded);
	// }
}