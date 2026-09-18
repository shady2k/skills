// Distribution invariants; runtime ingestion is tested separately by codex-smoke.mjs.
export function pluginContract({ hasPortableManifest, codex, claude, marketplace, pkg }) {
  const errors = [];
  for (const [label, manifest] of Object.entries({ codex, claude })) {
    if (manifest.name !== pkg.name) errors.push(`${label}: plugin name differs from package.json`);
    if (manifest.version !== pkg.version) errors.push(`${label}: version differs from package.json`);
  }
  if (hasPortableManifest)
    errors.push('portable: root plugin.json hides bucketed skills in Codex 0.154.0');
  if (codex.skills !== './skills/') errors.push('codex: must discover the complete skills/ tree');
  if (marketplace.name !== 'shady2k' || marketplace.plugins.length !== 1 ||
      marketplace.plugins[0].name !== pkg.name || marketplace.plugins[0].source !== './')
    errors.push('marketplace: must expose this root plugin as shady2k-skills@shady2k');
  return errors;
}
