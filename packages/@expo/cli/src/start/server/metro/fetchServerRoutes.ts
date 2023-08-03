/**
 * Copyright © 2022 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { sync as globSync } from 'glob';

import { requireFileContentsWithMetro } from '../getStaticRenderFunctions';
import { logMetroErrorAsync } from './metroErrorInterface';

const debug = require('debug')('expo:server-routes') as typeof console.log;

const pendingRouteOperations = new Map<string, Promise<string | null>>();

export type ApiRouteOptions = {
  mode?: string;
  appDir: string;
  port?: number;
};

export async function rebundleApiRoute(
  projectRoot: string,
  filepath: string,
  options: ApiRouteOptions
) {
  pendingRouteOperations.delete(filepath);
  return bundleApiRoute(projectRoot, filepath, options);
}

export async function bundleApiRoute(
  projectRoot: string,
  filepath: string,
  options: ApiRouteOptions
): Promise<string | null | undefined> {
  if (pendingRouteOperations.has(filepath)) {
    return pendingRouteOperations.get(filepath);
  }

  const devServerUrl = `http://localhost:${options.port}`;

  async function bundleAsync() {
    try {
      debug('Check API route:', options.appDir, filepath);

      const middleware = await requireFileContentsWithMetro(projectRoot, devServerUrl, filepath, {
        minify: options.mode === 'production',
        dev: options.mode !== 'production',
        // Ensure Node.js
        environment: 'node',
      });

      return middleware;
    } catch (error: any) {
      if (error instanceof Error) {
        await logMetroErrorAsync({ error, projectRoot });
      }
      // TODO: improve error handling, maybe have this be a mock function which returns the static error html
      return null;
    } finally {
      // pendingRouteOperations.delete(filepath);
    }
  }
  const route = bundleAsync();

  pendingRouteOperations.set(filepath, route);
  return route;
}

export async function eagerBundleApiRoutes(projectRoot: string, options: ApiRouteOptions) {
  return Promise.all(
    getApiRoutesForDirectory(options.appDir).map((filepath) =>
      bundleApiRoute(projectRoot, filepath, options)
    )
  );
}

export function getApiRoutesForDirectory(cwd: string) {
  return globSync('**/*+api.@(ts|tsx|js|jsx)', {
    cwd,
    absolute: true,
  });
}
