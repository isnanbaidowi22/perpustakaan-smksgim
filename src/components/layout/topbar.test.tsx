import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Topbar } from './topbar';

describe('Topbar', () => {
  it('menampilkan tahun ajaran ketika tersedia', () => {
    const html = renderToStaticMarkup(<Topbar academicYear="2026/2027" userName="Petugas" />);
    expect(html).toContain('Tahun Ajaran');
    expect(html).toContain('2026/2027');
  });

  it('menampilkan peringatan ketika tidak ada tahun ajaran aktif', () => {
    const html = renderToStaticMarkup(<Topbar academicYear={null} userName="Petugas" />);
    expect(html).toContain('Belum ada tahun ajaran aktif');
    expect(html).not.toContain('Tahun Ajaran ');
  });
});
