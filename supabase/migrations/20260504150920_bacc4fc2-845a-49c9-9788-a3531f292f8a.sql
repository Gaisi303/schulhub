
insert into storage.buckets (id, name, public) values ('downloads', 'downloads', false)
on conflict (id) do nothing;

create policy "downloads insert own"
on storage.objects for insert to authenticated
with check (bucket_id = 'downloads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "downloads select own"
on storage.objects for select to authenticated
using (bucket_id = 'downloads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "downloads delete own"
on storage.objects for delete to authenticated
using (bucket_id = 'downloads' and (storage.foldername(name))[1] = auth.uid()::text);
