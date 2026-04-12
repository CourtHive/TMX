import type { Page, ConsoleMessage } from '@playwright/test';

export interface MutationEntry {
  methods: Array<{ method: string; params: Record<string, unknown> }>;
  timestamp?: number;
}

/**
 * Collects mutation method calls logged to the browser console
 * when dev.context({ internal: true }) is active.
 *
 * Phase 1: passive console listener (zero source changes in TMX).
 * Phase 2: will switch to page.exposeFunction bridge for structured capture.
 *
 * Usage:
 *   const collector = createMutationCollector(page);
 *   // ... drive UI actions ...
 *   const mutations = collector.getMutations();
 *   expect(mutations.map(m => m.methods[0].method)).toEqual([...]);
 */
export function createMutationCollector(page: Page) {
  const mutations: MutationEntry[] = [];

  const handler = async (msg: ConsoleMessage) => {
    // dev.context({ internal: true }) logs: console.log({ methods: [...] })
    if (msg.type() !== 'log') return;

    try {
      const args = msg.args();
      if (args.length === 0) return;

      const value = await args[0].jsonValue().catch(() => null);
      if (value && typeof value === 'object' && 'methods' in value && Array.isArray(value.methods)) {
        mutations.push({
          methods: value.methods,
          timestamp: Date.now(),
        });
      }
    } catch {
      // jsonValue() can fail if the page navigates — ignore
    }
  };

  page.on('console', handler);

  return {
    /** Get all collected mutations so far */
    getMutations(): MutationEntry[] {
      return [...mutations];
    },

    /** Get just the method names in order */
    getMethodNames(): string[] {
      return mutations.flatMap((m) => m.methods.map((method) => method.method));
    },

    /** Clear collected mutations */
    clear(): void {
      mutations.length = 0;
    },

    /** Stop listening */
    detach(): void {
      page.removeListener('console', handler);
    },

    /** Check if a method name appears in the collected mutations */
    hasMethod(methodName: string): boolean {
      return mutations.some((m) => m.methods.some((method) => method.method === methodName));
    },

    /** Wait for a specific method to appear (with timeout) */
    async waitForMethod(methodName: string, timeoutMs = 5000): Promise<MutationEntry> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const found = mutations.find((m) => m.methods.some((method) => method.method === methodName));
        if (found) return found;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`Timed out waiting for mutation method: ${methodName}`);
    },
  };
}
