import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { buttonClass } from '@/components/ui/button-styles';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { updateBookAction } from '@/server/actions/books';
import { getBook } from '@/server/queries/books';
import { listCategoryOptions } from '@/server/queries/categories';
import { listRackOptions } from '@/server/queries/racks';
import { BookFields } from '../book-fields';

export default async function BookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const book = await getBook(id);
  if (!book) notFound();

  const [categoryOptions, rackOptions] = await Promise.all([
    listCategoryOptions(book.categoryId),
    listRackOptions(book.rackId),
  ]);

  return (
    <>
      <PageHeader
        title={book.title}
        description={book.status === 'active' ? book.author : `${book.author} · Nonaktif`}
        actions={<Link href="/master/buku" className={buttonClass('secondary')}>Kembali ke daftar</Link>}
      />
      <Flash message={firstValue(query.pesan)} />

      <section aria-labelledby="data-buku" className="space-y-4">
        <h2 id="data-buku" className="text-xl font-semibold">Data Buku</h2>
        <ActionForm action={updateBookAction.bind(null, book.id)} submitLabel="Simpan Perubahan">
          <BookFields book={book} categoryOptions={categoryOptions} rackOptions={rackOptions} />
        </ActionForm>
      </section>
    </>
  );
}
