/**
 * tools/studio/test/f09-unity-setup.test.ts
 * Phase F9 validation: verifies Unity 6 LTS project setup, packages, project settings,
 * assembly definitions, art manifest importer, views, prefabs, and main scene.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Phase F9 — Unity 6 LTS Integration', () => {
  it('has valid Packages/manifest.json configured for Unity 6 LTS', () => {
    const manifestPath = join(ROOT, 'Packages', 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.dependencies).toBeDefined();
    expect(manifest.dependencies['com.unity.render-pipelines.universal']).toBeDefined();
    expect(manifest.dependencies['com.unity.ugui']).toBeDefined();
    expect(manifest.dependencies['com.unity.inputsystem']).toBeDefined();
    expect(manifest.dependencies['com.unity.2d.sprite']).toBeDefined();
    expect(manifest.dependencies['com.unity.test-framework']).toBeDefined();
  });

  it('pins Unity 6 LTS in ProjectSettings/ProjectVersion.txt', () => {
    const versionPath = join(ROOT, 'ProjectSettings', 'ProjectVersion.txt');
    expect(existsSync(versionPath)).toBe(true);

    const content = readFileSync(versionPath, 'utf8');
    expect(content).toMatch(/m_EditorVersion:\s*6000\.0\./);
  });

  it('has ProjectSettings configured with portrait orientation and IL2CPP ARM64', () => {
    const settingsPath = join(ROOT, 'ProjectSettings', 'ProjectSettings.asset');
    expect(existsSync(settingsPath)).toBe(true);

    const content = readFileSync(settingsPath, 'utf8');
    expect(content).toContain('defaultScreenOrientation: 1'); // Portrait
    expect(content).toContain('com.studiobrasa.churrascomestredabrasa');
    expect(content).toContain('targetArchitectures: 2'); // ARM64
    expect(content).toContain('colorSpace: 1'); // Linear
  });

  it('configures assembly definitions according to architecture boundaries', () => {
    // Core asmdef must be pure engine-free
    const coreAsmdefPath = join(ROOT, 'Assets', 'Scripts', 'Core', 'Churrasco.Core.asmdef');
    expect(existsSync(coreAsmdefPath)).toBe(true);
    const coreAsmdef = JSON.parse(readFileSync(coreAsmdefPath, 'utf8'));
    expect(coreAsmdef.name).toBe('Churrasco.Core');
    expect(coreAsmdef.noEngineReferences).toBe(true);
    expect(coreAsmdef.references).toEqual([]);

    // Runtime asmdef references Core, InputSystem, TextMeshPro, UI
    const runtimeAsmdefPath = join(ROOT, 'Assets', 'Scripts', 'Runtime', 'Churrasco.Runtime.asmdef');
    expect(existsSync(runtimeAsmdefPath)).toBe(true);
    const runtimeAsmdef = JSON.parse(readFileSync(runtimeAsmdefPath, 'utf8'));
    expect(runtimeAsmdef.name).toBe('Churrasco.Runtime');
    expect(runtimeAsmdef.references).toContain('Churrasco.Core');
    expect(runtimeAsmdef.references).toContain('Unity.InputSystem');
    expect(runtimeAsmdef.references).toContain('Unity.TextMeshPro');
    expect(runtimeAsmdef.references).toContain('UnityEngine.UI');

    // Services asmdef references Core
    const servicesAsmdefPath = join(ROOT, 'Assets', 'Scripts', 'Services', 'Churrasco.Services.asmdef');
    expect(existsSync(servicesAsmdefPath)).toBe(true);
    const servicesAsmdef = JSON.parse(readFileSync(servicesAsmdefPath, 'utf8'));
    expect(servicesAsmdef.name).toBe('Churrasco.Services');
    expect(servicesAsmdef.references).toContain('Churrasco.Core');

    // Editor asmdef restricted to Editor platform
    const editorAsmdefPath = join(ROOT, 'Assets', 'Scripts', 'Editor', 'Churrasco.Editor.asmdef');
    expect(existsSync(editorAsmdefPath)).toBe(true);
    const editorAsmdef = JSON.parse(readFileSync(editorAsmdefPath, 'utf8'));
    expect(editorAsmdef.name).toBe('Churrasco.Editor');
    expect(editorAsmdef.includePlatforms).toContain('Editor');
  });

  it('implements complete runtime views and controllers', () => {
    const runtimeDir = join(ROOT, 'Assets', 'Scripts', 'Runtime');
    const requiredFiles = [
      'GrillView.cs',
      'FoodView.cs',
      'CustomerCardView.cs',
      'TurnFlowController.cs',
      'TouchInputController.cs',
      'AudioController.cs',
      'SaveManager.cs',
      'LocalizationManager.cs'
    ];

    for (const file of requiredFiles) {
      const fullPath = join(runtimeDir, file);
      expect(existsSync(fullPath)).toBe(true);
      const text = readFileSync(fullPath, 'utf8');

      // Verify basic C# brace balance and namespace
      expect(text).toContain('namespace Churrasco.Runtime');
      const openBraces = (text.match(/\{/g) || []).length;
      const closeBraces = (text.match(/\}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    }
  });

  it('includes Editor art manifest importer', () => {
    const importerPath = join(ROOT, 'Assets', 'Scripts', 'Editor', 'ArtManifestImporter.cs');
    expect(existsSync(importerPath)).toBe(true);
    const content = readFileSync(importerPath, 'utf8');
    expect(content).toContain('class ArtManifestImporter');
    expect(content).toContain('Assets/Art/sprites.manifest.json');
    expect(content).toContain('ASTC_6x6');
  });

  it('provides Unity YAML scene and prefabs', () => {
    const scenePath = join(ROOT, 'Assets', 'Scenes', 'Main.unity');
    expect(existsSync(scenePath)).toBe(true);
    const sceneText = readFileSync(scenePath, 'utf8');
    expect(sceneText).toContain('%YAML 1.1');
    expect(sceneText).toContain('TurnFlowController');

    const prefabs = ['FoodItem.prefab', 'CustomerCard.prefab', 'FloatingText.prefab'];
    for (const prefab of prefabs) {
      const prefabPath = join(ROOT, 'Assets', 'Prefabs', prefab);
      expect(existsSync(prefabPath)).toBe(true);
      const prefabText = readFileSync(prefabPath, 'utf8');
      expect(prefabText).toContain('%YAML 1.1');
    }
  });
});
