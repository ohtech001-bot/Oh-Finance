import { describe, expect, it } from 'vitest';
import { csvCell } from './csv';

describe('safe spreadsheet export', () => {
  it.each(['=HYPERLINK("https://example.com")', '+SUM(1,2)', '@SUM(1,2)', '-1+CMD()', ' \t=1+1'])(
    'neutralizes user-supplied formula %s',
    (value) => {
      expect(csvCell(value).replace(/^"/, '')).toMatch(/^'/);
    },
  );
  it('preserves signed monetary values', () => {
    expect(csvCell('-500.00')).toBe('-500.00');
    expect(csvCell('+200.00')).toBe('+200.00');
  });
  it('escapes quotes and carriage returns', () => {
    expect(csvCell('a"b\rc')).toBe('"a""b\rc"');
  });
});
