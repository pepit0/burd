-- Friend RPCs were created without execute grants; PostgREST rejects authenticated calls.

grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
grant execute on function public.unfriend(uuid) to authenticated;

grant execute on function public.friend_ids() to authenticated;
grant execute on function public.incoming_friend_request_ids() to authenticated;
grant execute on function public.outgoing_friend_request_ids() to authenticated;
grant execute on function public.following_feed() to authenticated;
