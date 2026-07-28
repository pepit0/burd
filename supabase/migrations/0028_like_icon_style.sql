alter table public.profiles
  add column if not exists like_icon_style text not null default 'heart'
    check (like_icon_style in ('heart', 'thumbs_up', 'bird', 'burd', 'leaf'));
