create or replace function public.__tmp_check_invited_at()
returns table(col text, dtype text)
language sql
security definer
set search_path = public
as $$
  select column_name, data_type
  from information_schema.columns
  where table_schema = 'auth' and table_name = 'users' and column_name = 'invited_at';
$$;
