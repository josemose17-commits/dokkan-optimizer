import { test as base, expect } from '@playwright/test';

// Every test fails on uncaught page errors, console errors, failed requests,
// requests outside the local origin, or root-relative asset paths.
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page, baseURL }, use) => {
      const problems: string[] = [];
      const origin = new URL(baseURL!).origin;
      page.on('pageerror', (error) =>
        problems.push(`page error: ${error.message}`),
      );
      page.on('console', (message) => {
        if (message.type() === 'error')
          problems.push(`console error: ${message.text()}`);
      });
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol === 'data:' || url.protocol === 'blob:') return;
        if (url.origin !== origin) problems.push(`external request: ${url}`);
        else if (!url.pathname.startsWith('/dokkan-optimizer/'))
          problems.push(`outside Pages prefix: ${url.pathname}`);
      });
      page.on('response', (response) => {
        if (response.status() >= 400)
          problems.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      await use(problems);
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const WORKING_KEY = 'dokkan.character-builds.v1';
export const LIBRARY_KEY = 'dokkan.character-library.v1';
export const LEGACY_KEY = 'dokkan-team-lab.collection.v1';
