/**
 * Copyright © 2022 650 Industries.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import invariant from 'invariant';
import jscSafeUrl from 'jsc-safe-url';
import type { MixedOutput, Module } from 'metro';
// @ts-expect-error
import { addParamsToDefineCall } from 'metro-transform-plugins';
import type { JsOutput } from 'metro-transform-worker';
import path from 'path';

import { fileNameFromContents } from '../getCssDeps';

export type Options = {
  createModuleId: (module: string) => number | string;
  dev: boolean;
  includeAsyncPaths: boolean;
  projectRoot: string;
  serverRoot: string;
  sourceUrl: string | undefined;
  //   ...
};

export function wrapModule(
  module: Module,
  options: Options
): { src: string; paths: Record<string, string> } {
  const output = getJsOutput(module);

  if (output.type.startsWith('js/script')) {
    return { src: output.data.code, paths: {} };
  }

  const { params, paths } = getModuleParams(module, options);
  const src = addParamsToDefineCall(output.data.code, ...params);

  return { src, paths };
}

export function getModuleParams(
  module: Module,
  options: Options
): { params: any[]; paths: Record<string, string> } {
  const moduleId = options.createModuleId(module.path);

  const paths: { [moduleID: number | string]: any } = {};
  let hasPaths = false;
  const dependencyMapArray = Array.from(module.dependencies.values()).map((dependency) => {
    const id = options.createModuleId(dependency.absolutePath);
    if (
      // NOTE(EvanBacon): Disabled this to ensure that paths are provided even when the entire bundle
      // is created. This is required for production bundle splitting.
      // options.includeAsyncPaths &&
      options.sourceUrl &&
      dependency.data.data.asyncType != null
    ) {
      hasPaths = true;
      invariant(options.sourceUrl != null, 'sourceUrl is required when includeAsyncPaths is true');

      // TODO: Only include path if the target is not in the bundle

      // Construct a server-relative URL for the split bundle, propagating
      // most parameters from the main bundle's URL.

      const { searchParams } = new URL(jscSafeUrl.toNormalUrl(options.sourceUrl));
      searchParams.set('modulesOnly', 'true');
      searchParams.set('runModule', 'false');

      const bundlePath = path.relative(options.serverRoot, dependency.absolutePath);
      if (options.dev) {
        paths[id] =
          '/' +
          path.join(
            path.dirname(bundlePath),
            // Strip the file extension
            path.basename(bundlePath, path.extname(bundlePath))
          ) +
          '.bundle?' +
          searchParams.toString();
      } else {
        // NOTE(EvanBacon): Custom block for bundle splitting in production according to how `expo export` works
        // TODO: Add content hash
        paths[id] = '/' + getExportPathForDependency(dependency.absolutePath, options);
      }
    }
    return id;
  });

  const params = [
    moduleId,
    hasPaths
      ? {
          // $FlowIgnore[not-an-object] Intentionally spreading an array into an object
          ...dependencyMapArray,
          paths,
        }
      : dependencyMapArray,
  ];

  if (options.dev) {
    // Add the relative path of the module to make debugging easier.
    // This is mapped to `module.verboseName` in `require.js`.
    params.push(path.relative(options.projectRoot, module.path));
  }

  return { params, paths };
}

export function getExportPathForDependency(
  dependencyPath: string,
  options: Pick<Options, 'sourceUrl' | 'serverRoot'>
): string {
  //   console.log('getExportPathForDependency', dependency.data.data.locs, options);
  const { searchParams } = new URL(jscSafeUrl.toNormalUrl(options.sourceUrl!));
  return getExportPathForDependencyWithOptions(dependencyPath, {
    platform: searchParams.get('platform')!,
    serverRoot: options.serverRoot,
  });
}

export function getExportPathForDependencyWithOptions(
  dependencyPath: string,
  { platform, serverRoot }: { platform: string; serverRoot: string }
): string {
  //   console.log('getExportPathForDependency', dependency.data.data.locs, options);
  const bundlePath = path.relative(serverRoot, dependencyPath);
  const relativePathname = path.join(
    path.dirname(bundlePath),
    // Strip the file extension
    path.basename(bundlePath, path.extname(bundlePath))
  );
  const name = fileNameFromContents({
    filepath: relativePathname,
    // TODO: Add content hash
    src: relativePathname,
  });
  return (
    `_expo/static/js/${platform}/` +
    // make filename safe
    // dependency.data.data.key.replace(/[^a-z0-9]/gi, '_') +
    name +
    '.js'
  );
}

export function getJsOutput(module: {
  output: readonly MixedOutput[];
  path?: string;
  // ...
}): JsOutput {
  const jsModules = module.output.filter(({ type }) => type.startsWith('js/'));

  invariant(
    jsModules.length === 1,
    `Modules must have exactly one JS output, but ${module.path ?? 'unknown module'} has ${
      jsModules.length
    } JS outputs.`
  );

  const jsOutput: JsOutput = jsModules[0] as unknown as any;
  //   const jsOutput: JsOutput = (jsModules[0]: any);

  invariant(
    Number.isFinite(jsOutput.data.lineCount),
    `JS output must populate lineCount, but ${module.path ?? 'unknown module'} has ${
      jsOutput.type
    } output with lineCount '${jsOutput.data.lineCount}'`
  );

  return jsOutput;
}

export function isJsModule(module: Module): boolean {
  return module.output.filter(isJsOutput).length > 0;
}

export function isJsOutput(output: MixedOutput): output is MixedOutput {
  return output.type.startsWith('js/');
}
