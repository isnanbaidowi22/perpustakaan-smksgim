// Konstanta ini dibaca layout (Server Component), jadi tidak boleh tinggal di
// modul 'use client' sidebar.tsx: ekspor modul klien sampai ke server sebagai
// rujukan klien, bukan sebagai untai.

/** Cookie yang mengingat menu diciutkan, agar render server langsung benar. */
export const SIDEBAR_COOKIE = 'menu';
export const SIDEBAR_RAIL = 'ringkas';
