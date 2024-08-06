import findWorkspaceRoot from 'find-yarn-workspace-root';
import path from 'path';

import { env } from './env';

/** Wraps `findWorkspaceRoot` and guards against having an empty `package.json` file in an upper directory. */
export function getWorkspaceRoot(projectRoot: string): string | null {
  try {
    return findWorkspaceRoot(projectRoot);
  } catch (error: any) {
    if (error.message.includes('Unexpected end of JSON input')) {
      return null;
    }
    throw error;
  }
}

export function getModulesPaths(projectRoot: string): string[] {
  const paths: string[] = [];

  // Only add the project root if it's not the current working directory
  // this minimizes the chance of Metro resolver breaking on new Node.js versions.
  const workspaceRoot = getWorkspaceRoot(path.resolve(projectRoot)); // Absolute path or null
  if (workspaceRoot) {
    paths.push(path.resolve(projectRoot, 'node_modules'));
    paths.push(path.resolve(workspaceRoot, 'node_modules'));
  }

  return paths;
}

export function getServerRoot(projectRoot: string) {
  if (env.EXPO_NO_METRO_WORKSPACE_ROOT) {
    return projectRoot;
  }

  return getWorkspaceRoot(projectRoot) ?? projectRoot;
}
