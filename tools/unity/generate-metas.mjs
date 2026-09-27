/**
 * tools/unity/generate-metas.mjs
 * Generates deterministic Unity .meta files for assets in Assets/ using stable GUIDs.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = join(import.meta.dirname, '..', '..');
const ASSETS_DIR = join(ROOT, 'Assets');
const MANIFEST_PATH = join(ASSETS_DIR, 'Art', 'sprites.manifest.json');

// Generate deterministic 32-hex GUID from relative path
function pathToGuid(relPath) {
  return createHash('md5').update('churrasco:' + relPath.toLowerCase().replace(/\\/g, '/')).digest('hex');
}

let manifest = { sprites: {} };
if (existsSync(MANIFEST_PATH)) {
  manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
}

function folderMeta(guid) {
  return `fileFormatVersion: 2
guid: ${guid}
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}

function scriptMeta(guid) {
  return `fileFormatVersion: 2
guid: ${guid}
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}

function asmdefMeta(guid) {
  return `fileFormatVersion: 2
guid: ${guid}
AssemblyDefinitionImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}

function textureMeta(guid, pivot = [0.5, 0.5], packingTag = '') {
  const px = Number(pivot[0] ?? 0.5);
  const py = Number(pivot[1] ?? 0.5);
  return `fileFormatVersion: 2
guid: ${guid}
TextureImporter:
  internalIDToNameTable: []
  externalObjects: {}
  serializedVersion: 13
  mipmaps:
    mipMapMode: 0
    enableMipMap: 0
  bumpMap:
    setup: 0
  isReadable: 0
  streamingMipmaps: 0
  streamingMipmapsPriority: 0
  vramBudgetMB: 0
  grayScaleToAlpha: 0
  generateCubemap: 6
  cubemapConvolution: 0
  seamlessCubemap: 0
  textureFormat: 1
  maxTextureSize: 2048
  textureSettings:
    serializedVersion: 2
    filterMode: 1
    aniso: 1
    mipBias: 0
    wrapU: 1
    wrapV: 1
    wrapW: 1
  nPOTScale: 0
  lightmap: 0
  compressionQuality: 50
  spriteMode: 1
  spriteExtrude: 1
  spriteMeshType: 1
  alignment: 9
  spritePivot: {x: ${px}, y: ${py}}
  spritePixelsToUnits: 100
  spriteBorder: {x: 0, y: 0, z: 0, w: 0}
  spriteGenerateFallbackPhysicsShape: 1
  alphaUsage: 1
  alphaIsTransparency: 1
  spriteTessellationDetail: -1
  textureType: 8
  textureShape: 1
  singleChannelComponent: 0
  flipbookRows: 1
  flipbookColumns: 1
  maxTextureSizeSet: 0
  compressionQualitySet: 0
  textureFormatSet: 0
  ignorePngGamma: 0
  applyGammaDecoding: 0
  cookieLightType: 0
  platformSettings:
  - serializedVersion: 4
    buildTarget: DefaultTexturePlatform
    maxTextureSize: 2048
    resizeAlgorithm: 0
    format: -1
    textureCompression: 1
    compressionQuality: 50
    crunchedCompression: 0
    allowsAlphaSplitting: 0
    overridden: 0
    ignorePlatformSupport: 0
  - serializedVersion: 4
    buildTarget: Android
    maxTextureSize: 2048
    resizeAlgorithm: 0
    format: 51
    textureCompression: 1
    compressionQuality: 50
    crunchedCompression: 0
    allowsAlphaSplitting: 0
    overridden: 1
    ignorePlatformSupport: 0
  spriteSheet:
    serializedVersion: 2
    sprites: []
    outline: []
    physicsShape: []
    bones: []
    spriteID: 
    internalID: 0
    vertices: []
    indices: 
    edges: []
    weights: []
  spritePackingTag: ${packingTag}
  pSDRemoveMatte: 0
  pSDShowRemoveMatteOption: 0
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}

function audioMeta(guid) {
  return `fileFormatVersion: 2
guid: ${guid}
AudioImporter:
  externalObjects: {}
  serializedVersion: 6
  defaultSettings:
    loadType: 0
    sampleRateSetting: 0
    sampleRateOverride: 44100
    compressionFormat: 1
    quality: 1
    conversionMode: 0
  platformSettingOverrides: {}
  forceToMono: 0
  normalize: 1
  preloadAudioData: 1
  loadInBackground: 0
  ambisonic: 0
  3D: 0
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}

function defaultMeta(guid) {
  return `fileFormatVersion: 2
guid: ${guid}
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}

async function walkAndGenerate(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.endsWith('.meta')) continue;
    const fullPath = join(dir, entry.name);
    const relPath = relative(ROOT, fullPath);
    const metaPath = `${fullPath}.meta`;
    const guid = pathToGuid(relPath);

    if (entry.isDirectory()) {
      if (!existsSync(metaPath)) {
        await writeFile(metaPath, folderMeta(guid), 'utf8');
      }
      await walkAndGenerate(fullPath);
    } else {
      if (existsSync(metaPath)) continue;
      if (entry.name.endsWith('.cs')) {
        await writeFile(metaPath, scriptMeta(guid), 'utf8');
      } else if (entry.name.endsWith('.asmdef')) {
        await writeFile(metaPath, asmdefMeta(guid), 'utf8');
      } else if (entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.webp')) {
        let pivot = [0.5, 0.5];
        let packingTag = '';
        for (const [id, data] of Object.entries(manifest.sprites || {})) {
          if (data.file && relPath.replace(/\\/g, '/').endsWith(data.file)) {
            pivot = data.pivot || [0.5, 0.5];
            packingTag = data.category ? `atlas_${data.category}` : '';
            break;
          }
        }
        await writeFile(metaPath, textureMeta(guid, pivot, packingTag), 'utf8');
      } else if (entry.name.endsWith('.wav') || entry.name.endsWith('.mp3') || entry.name.endsWith('.ogg')) {
        await writeFile(metaPath, audioMeta(guid), 'utf8');
      } else {
        await writeFile(metaPath, defaultMeta(guid), 'utf8');
      }
    }
  }
}

console.log('[generate-metas] Scanning Assets/ directory...');
await walkAndGenerate(ASSETS_DIR);
console.log('[generate-metas] Done.');
