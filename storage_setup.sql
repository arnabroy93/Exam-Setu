-- Set up Storage for AcadEx
insert into storage.buckets (id, name, public)
values ('exam_files', 'exam_files', true)
on conflict (id) do nothing;

create policy "Exam files are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'exam_files' );

create policy "Users can upload exam files"
  on storage.objects for insert
  with check ( bucket_id = 'exam_files' AND auth.role() = 'authenticated' );

create policy "Users can update their own exam files"
  on storage.objects for update
  using ( bucket_id = 'exam_files' AND auth.uid() = owner );

create policy "Users can delete their own exam files"
  on storage.objects for delete
  using ( bucket_id = 'exam_files' AND auth.uid() = owner );
