/**
 * Copyright © 2022 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import fs from 'fs';
import path from 'path';
import requireString from 'require-from-string';

import { logMetroError } from './metro/metroErrorInterface';
import { getMetroServerRoot } from './middleware/ManifestMiddleware';
import { delayAsync } from '../../utils/delay';
import { SilentError } from '../../utils/errors';
import { profile } from '../../utils/profile';

const debug = require('debug')('expo:start:server:node-renderer') as typeof console.log;

export function wrapBundle(str: string) {
  // Skip the metro runtime so debugging is a bit easier.
  // Replace the __r() call with an export statement.
  // Use gm to apply to the last require line. This is needed when the bundle has side-effects.
  return str.replace(/^(__r\(.*\);)$/gm, 'module.exports = $1');
}

export function stripProcess(str: string) {
  // TODO: Remove from the metro prelude
  return str.replace(/process=this\.process\|\|{},/m, '');
}

type StaticRenderOptions = {
  // Ensure the style format is `css-xxxx` (prod) instead of `css-view-xxxx` (dev)
  dev?: boolean;
  minify?: boolean;
  platform?: string;
  environment?: 'node';
};

/** @returns the js file contents required to generate the static generation function. */

async function ensureFileInRootDirectory(projectRoot: string, otherFile: string) {
  // Cannot be accessed using Metro's server API, we need to move the file
  // into the project root and try again.
  if (!path.relative(projectRoot, otherFile).startsWith('../')) {
    return otherFile;
  }

  // Copy the file into the project to ensure it works in monorepos.
  // This means the file cannot have any relative imports.
  const tempDir = path.join(projectRoot, '.expo/static-tmp');
  await fs.promises.mkdir(tempDir, { recursive: true });
  const moduleId = path.join(tempDir, path.basename(otherFile));
  await fs.promises.writeFile(moduleId, await fs.promises.readFile(otherFile, 'utf8'));
  // Sleep to give watchman time to register the file.
  await delayAsync(50);
  return moduleId;
}

export async function createMetroEndpointAsync(
  projectRoot: string,
  devServerUrl: string,
  absoluteFilePath: string,
  { dev = false, platform = 'web', minify = false, environment }: StaticRenderOptions = {}
): Promise<string> {
  const root = getMetroServerRoot(projectRoot);
  const safeOtherFile = await ensureFileInRootDirectory(projectRoot, absoluteFilePath);
  const serverPath = path.relative(root, safeOtherFile).replace(/\.[jt]sx?$/, '.bundle');
  debug('fetching from Metro:', root, serverPath);

  let url = `${devServerUrl}/${serverPath}?platform=${platform}&dev=${dev}&minify=${minify}`;

  if (environment) {
    url += `&resolver.environment=${environment}&transform.environment=${environment}`;
  }
  return url;
}

export class MetroNodeError extends Error {
  constructor(
    message: string,
    public rawObject: any
  ) {
    super(message);
  }
}

export function evalStaticRenderFunctionsBundle(
  projectRoot: string,
  bundle: string
): Record<string, (...args: any[]) => Promise<any>> {
  const contents = evalMetro(bundle);

  // wrap each function with a try/catch that uses Metro's error formatter
  return Object.keys(contents).reduce((acc, key) => {
    const fn = contents[key];
    if (typeof fn !== 'function') {
      return { ...acc, [key]: fn };
    }

    acc[key] = async function (...props: any[]) {
      try {
        return await fn.apply(this, props);
      } catch (error: any) {
        await logMetroError(projectRoot, { error });
        throw new SilentError(error);
      }
    };
    return acc;
  }, {} as any);
}

function evalMetro(src: string) {
  return profile(requireString, 'eval-metro-bundle')(src);
}
