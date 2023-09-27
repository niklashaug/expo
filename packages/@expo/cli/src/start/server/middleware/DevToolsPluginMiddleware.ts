import { readFile } from 'fs/promises';
import path from 'path';

import { ExpoMiddleware } from './ExpoMiddleware';
import { ServerRequest, ServerResponse } from './server.types';
import DevToolsPluginManager, { DevToolsPluginEndpoint } from '../DevToolsPluginManager';

export { DevToolsPluginEndpoint };

export class DevToolsPluginMiddleware extends ExpoMiddleware {
  constructor(
    projectRoot: string,
    private readonly pluginManager: DevToolsPluginManager
  ) {
    super(projectRoot, [DevToolsPluginEndpoint]);
  }

  override shouldHandleRequest(req: ServerRequest): boolean {
    if (req.url === '/') {
      return false;
    }
    // this middleware uses `app.use(DevToolsPluginEndpoint, ...)`, so the `req.url` will strip the `DevToolsPluginEndpoint` from the URL.
    return true;
  }

  async handleRequestAsync(req: ServerRequest, res: ServerResponse): Promise<void> {
    const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const pluginName = pathname.split('/')[1];
    if (!pluginName) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const webpageRoot = await this.pluginManager.queryPluginWebpageRootAsync(pluginName);
    if (!webpageRoot) {
      res.statusCode = 404;
      res.end();
      return;
    }

    if (pathname.includes('/static/')) {
      const filePath = pathname.substring(pathname.indexOf('/static/') + 8);
      const content = (await readFile(path.join(webpageRoot, 'static', filePath))).toString(
        'utf-8'
      );
      res.setHeader('Content-Type', DevToolsPluginMiddleware.getContentType(filePath));
      res.end(content);
    } else {
      const content = (await readFile(path.join(webpageRoot, 'index.html'))).toString('utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.end(content);
    }
  }

  private static getContentType(filePath: string): string {
    switch (path.extname(filePath)) {
      case '.svg':
        return 'image/svg+xml';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.css':
        return 'text/css';
      case '.js':
        return 'application/javascript';
      case '.html':
        return 'text/html';
      default:
        return 'text/plain';
    }
  }
}
