// Kolom pertama dan terakhir diberi bantalan selebar isi kartu (24px) agar
// sejajar dengan judul kartu di atasnya. Di kertas bantalannya dirapatkan.
const CELL = 'px-4 first:pl-6 last:pr-6 print:px-2 print:first:pl-2 print:last:pr-2';

/** Kelas sel tabel. Pembungkus tabelnya adalah `<ScrollTable>`. */
export const TH =
  `${CELL} whitespace-nowrap border-b border-[var(--color-divider)] bg-[var(--color-ink-50)] py-2.5 text-left text-[13px] font-medium text-[var(--color-ink-500)] print:py-1.5`;
export const TD =
  `${CELL} border-b border-[var(--color-divider)] py-3 align-middle text-[var(--color-ink-700)] [tr:last-child>&]:border-b-0 print:py-1.5`;
