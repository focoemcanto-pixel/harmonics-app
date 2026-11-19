-- Lock the conversation first, as the Meta echo handler does.
create or replace function public.ai_approve_draft(
  p_workspace_id uuid, p_outbox_id uuid, p_actor_user_id uuid, p_content text default null
) returns table (outbox_id uuid)
language plpgsql security invoker set search_path = public as $$
declare
  c public.ai_conversations%rowtype;
  approved_id uuid;
begin
  select conv.* into c from public.ai_conversations conv
    join public.ai_message_outbox o on o.conversation_id = conv.id and o.workspace_id = conv.workspace_id
    where conv.workspace_id = p_workspace_id and o.id = p_outbox_id
    for update of conv;
  if not found or c.owner <> 'ai' or c.state <> 'open' then
    return query select null::uuid;
    return;
  end if;
  update public.ai_message_outbox
     set status = 'pending', sender_type = 'human', author_user_id = p_actor_user_id,
         owner_version = c.owner_version + 1, content = coalesce(nullif(p_content,''), content), updated_at = now()
   where id = p_outbox_id and workspace_id = p_workspace_id and conversation_id = c.id
     and status = 'draft' and sender_type = 'ai' and owner_version = c.owner_version
   returning id into approved_id;
  if approved_id is not null then
    perform public.ai_switch_conversation_owner(p_workspace_id,c.id,'human','draft_approved',p_actor_user_id);
  end if;
  return query select approved_id;
end $$;
