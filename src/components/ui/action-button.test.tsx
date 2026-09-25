import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActionButton } from './action-button';

describe('ActionButton', () => {
  it('menampilkan label tombol tanpa pesan sebelum ditekan', () => {
    const html = renderToStaticMarkup(<ActionButton action={vi.fn()} label="Nonaktifkan" />);
    expect(html).toContain('Nonaktifkan');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('role="alert"');
  });
});
