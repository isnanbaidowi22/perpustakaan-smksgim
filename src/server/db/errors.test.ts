import { describe, expect, it } from 'vitest';
import { sqlState, uniqueViolation } from './errors';

describe('uniqueViolation', () => {
  it('mengenali galat Postgres yang dibungkus DrizzleQueryError', () => {
    const wrapped = Object.assign(new Error('Failed query: insert ...'), {
      cause: { code: '23505', constraint_name: 'categories_name_unique' },
    });
    expect(uniqueViolation(wrapped)).toBe('categories_name_unique');
  });

  it('mengenali galat Postgres yang tidak dibungkus', () => {
    expect(uniqueViolation({ code: '23505', constraint_name: 'racks_code_unique' })).toBe('racks_code_unique');
  });

  it('mengabaikan pelanggaran constraint selain unik', () => {
    expect(uniqueViolation({ code: '23503', constraint_name: 'books_category_id_categories_id_fk' })).toBeNull();
  });

  it('mengabaikan nilai yang bukan galat Postgres', () => {
    expect(uniqueViolation(new Error('jaringan putus'))).toBeNull();
    expect(uniqueViolation(null)).toBeNull();
    expect(uniqueViolation('23505')).toBeNull();
  });
});

describe('sqlState', () => {
  it('membaca kode SQLSTATE dari galat yang dibungkus Drizzle', () => {
    const wrapped = Object.assign(new Error('Failed query: select ...'), { cause: { code: '55P03' } });
    expect(sqlState(wrapped)).toBe('55P03');
  });

  it('mengembalikan null untuk galat yang bukan dari Postgres', () => {
    expect(sqlState(new Error('bukan galat database'))).toBeNull();
    expect(sqlState(null)).toBeNull();
  });
});
