ALTER TABLE public.workspace_invites ADD COLUMN IF NOT EXISTS role public.workspace_role NOT NULL DEFAULT 'staff';

CREATE OR REPLACE FUNCTION public.ensure_workspace(_name text DEFAULT NULL::text, _display text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt()->>'email',''));
  _ws uuid;
  _inv record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  FOR _inv IN SELECT * FROM workspace_invites WHERE lower(email) = _email ORDER BY (role='owner') ASC LOOP
    INSERT INTO workspace_members(workspace_id,user_id,role,email,display_name)
    VALUES (_inv.workspace_id,_uid,_inv.role,_email,_display) ON CONFLICT DO NOTHING;
    IF _inv.role = 'owner' THEN
      UPDATE workspaces SET owner_id = _uid WHERE id = _inv.workspace_id;
    END IF;
    DELETE FROM workspace_invites WHERE id = _inv.id;
    _ws := _inv.workspace_id;
  END LOOP;
  IF _ws IS NOT NULL THEN RETURN _ws; END IF;
  SELECT workspace_id INTO _ws FROM workspace_members WHERE user_id = _uid ORDER BY (role='owner') ASC, joined_at DESC LIMIT 1;
  IF _ws IS NOT NULL THEN
    UPDATE workspace_members SET display_name = coalesce(_display, display_name), email = coalesce(email,_email) WHERE user_id = _uid;
    RETURN _ws;
  END IF;
  INSERT INTO workspaces(name, owner_id) VALUES (coalesce(nullif(_name,''),'My Café'), _uid) RETURNING id INTO _ws;
  INSERT INTO workspace_members(workspace_id,user_id,role,email,display_name) VALUES (_ws,_uid,'owner',_email,_display);
  UPDATE records SET workspace_id = _ws WHERE user_id = _uid AND workspace_id IS NULL;
  RETURN _ws;
END $function$;