-- Custom SQL migration file, put your code below! --
create extension if not exists pg_trgm;

create index books_title_trgm on books using gin (title gin_trgm_ops);
create index students_name_trgm on students using gin (name gin_trgm_ops);

alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
