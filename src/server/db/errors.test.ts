import { describe, expect, it } from 'vitest';
import { uniqueViolation } from './errors';

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
