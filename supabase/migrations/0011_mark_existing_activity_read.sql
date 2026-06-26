-- Existing notifications before the inbox shipped should not flood the unread badge.
update public.activity
set read_at = created_at
where read_at is null;
