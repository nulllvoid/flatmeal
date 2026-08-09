-- take_fallback_cart_item: lets the app write a cart_items row for a poll
-- that's already 'closed' (locked) — specifically for the empty-cart-at-
-- lock edge state (mockup: "take the fallback"), where a member opts into
-- a safe dish after the normal open-cart writing window has passed.
--
-- cart_items' RLS intentionally blocks writes once status != 'open' (that
-- IS the lock mechanism — see supabase/migrations/20260109000000_cart_items.sql).
-- Rather than weaken that policy for every write, this is a narrow
-- security-definer escape hatch for this one action: it still requires the
-- caller to be a member of the poll's flat, and only touches cart_items for
-- a poll that is specifically 'closed' with zero existing lines (the exact
-- edge-state condition the app shows this action for) — it does not let a
-- member add to an already-populated locked cart, or to any 'dispatched'
-- or 'cancelled' poll.
create or replace function take_fallback_cart_item(
  p_poll_id uuid,
  p_recipe_id uuid,
  p_quantity int
)
returns void
language plpgsql
security definer
as $$
declare
  v_flat_id uuid;
  v_status text;
  v_existing_count int;
begin
  select flat_id, status into v_flat_id, v_status from daily_polls where id = p_poll_id;

  if v_flat_id is null then
    raise exception 'poll not found';
  end if;

  if not is_flat_member(v_flat_id) then
    raise exception 'not a member of this flat';
  end if;

  if v_status <> 'closed' then
    raise exception 'fallback can only be taken for a closed, empty cart';
  end if;

  select count(*) into v_existing_count from cart_items where poll_id = p_poll_id;
  if v_existing_count > 0 then
    raise exception 'cart is not empty — fallback no longer applies';
  end if;

  insert into cart_items (poll_id, recipe_id, quantity, added_by, updated_by)
  values (p_poll_id, p_recipe_id, p_quantity, auth.uid(), auth.uid())
  on conflict (poll_id, recipe_id) do nothing;
end;
$$;

grant execute on function take_fallback_cart_item(uuid, uuid, int) to authenticated;
