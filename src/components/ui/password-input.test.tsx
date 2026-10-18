import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('awalnya tersembunyi dengan tombol tampilkan', () => {
    const html = renderToStaticMarkup(<PasswordInput name="password" />);
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="Tampilkan kata sandi"');
    expect(html).toContain('type="button"');
  });
});
