// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { app } from 'electron';

import OS from '../ts/util/os/osMain.node.ts';

// The userData override from config (benchmarks, development profiles, AppImage), or undefined for
// Electron's default. Shared by user_config.main.ts, which applies it, and config.main.ts, which
// needs the same directory before node-config is frozen to read the remembered Tellomi region.
// `lookup` returns undefined for a missing key (so config.main.ts can pass raw property access).
export function getUserDataOverride(
  lookup: (key: 'storagePath' | 'storageProfile') => unknown
): string | undefined {
  const storagePath = lookup('storagePath');
  if (storagePath != null) {
    // Same coercion user_config.main.ts always applied to these config values.
    // oxlint-disable-next-line typescript/no-base-to-string
    return String(storagePath);
  }
  const storageProfile = lookup('storageProfile');
  if (storageProfile != null) {
    // oxlint-disable-next-line typescript/no-base-to-string
    return join(app.getPath('appData'), `Signal-${String(storageProfile)}`);
  }
  if (OS.isAppImage()) {
    return join(app.getPath('appData'), `${app.getName()} AppImage`);
  }
  return undefined;
}
