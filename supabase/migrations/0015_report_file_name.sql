-- ============================================================================
-- 0015: capture the original uploaded file's name on report_uploads
-- ============================================================================
-- `storage_path` was always `<booking_id>/<uploaded_by>/<timestamp>.<ext>` —
-- the customer's original filename was never kept anywhere, so the Reports
-- table had nothing readable to show as "which file is this" beyond the
-- report_type category. No column-level insert grant change needed:
-- `grant select, insert on public.report_uploads to authenticated` (0002)
-- was never column-restricted, unlike bookings/profiles.

alter table public.report_uploads add column if not exists file_name text;
