alter table public.medical_library_entries
  drop constraint if exists medical_library_entries_entry_type_check;

alter table public.medical_library_entries
  add constraint medical_library_entries_entry_type_check
  check (entry_type in ('note', 'highlight', 'bookmark', 'canvas', 'attachment'));
