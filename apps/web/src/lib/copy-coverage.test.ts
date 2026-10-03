import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import hebrew from '../locales/copy-he.json';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const file = join(directory, item.name);
    return item.isDirectory()
      ? files(file)
      : /\.tsx?$/.test(file) && !/\.(test|spec)\./.test(file)
        ? [file]
        : [];
  });
}

describe('UI copy coverage', () => {
  it('includes a reviewed Hebrew translation for every copy/print label', () => {
    const missing: string[] = [];
    for (const file of [
      ...files(join(root, 'apps/web/src')),
      ...files(join(root, 'packages/ui/src')),
    ]) {
      const tree = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && ['copy', 'tr'].includes(node.expression.getText(tree))) {
          const message = node.arguments[0];
          if (message && ts.isStringLiteralLike(message) && /[\u0600-\u06ff]/u.test(message.text)) {
            const key = message.text.replace(/\s+/g, ' ').trim();
            if (!(key in hebrew)) missing.push(`${file}: ${key}`);
          }
        }
        if (ts.isJsxText(node) && /[\u0600-\u06ff]/u.test(node.text))
          missing.push(`${file}: untranslated JSX ${node.text.trim()}`);
        ts.forEachChild(node, visit);
      }
      visit(tree);
    }
    expect(missing).toEqual([]);
  });
});
