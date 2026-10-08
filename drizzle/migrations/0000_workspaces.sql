CREATE TYPE public.workspace_role AS ENUM ('owner','staff');

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Café',
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'staff',
  email text,
  display_name text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
GRANT SELECT, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);
GRANT SELECT, INSERT, DELETE ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _ws AND user_id = _uid)
$$;
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _ws AND user_id = _uid AND role = 'owner')
$$;

CREATE POLICY "members read ws" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id, auth.uid()));
CREATE POLICY "owner updates ws" ON public.workspaces FOR UPDATE TO authenticated USING (public.is_workspace_owner(id, auth.uid())) WITH CHECK (public.is_workspace_owner(id, auth.uid()));
CREATE POLICY "members read members" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "owner removes staff" ON public.workspace_members FOR DELETE TO authenticated USING (public.is_workspace_owner(workspace_id, auth.uid()) AND role = 'staff');
CREATE POLICY "members read invites" ON public.workspace_invites FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "owner invites" ON public.workspace_invites FOR INSERT TO authenticated WITH CHECK (public.is_workspace_owner(workspace_id, auth.uid()));
CREATE POLICY "owner deletes invites" ON public.workspace_invites FOR DELETE TO authenticated USING (public.is_workspace_owner(workspace_id, auth.uid()));

-- Join via invite, or create own workspace. Returns workspace id.
CREATE OR REPLACE FUNCTION public.ensure_workspace(_name text DEFAULT NULL, _display text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt()->>'email',''));
  _ws uuid;
  _inv record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  FOR _inv IN SELECT * FROM workspace_invites WHERE lower(email) = _email LOOP
    INSERT INTO workspace_members(workspace_id,user_id,role,email,display_name)
    VALUES (_inv.workspace_id,_uid,'staff',_email,_display) ON CONFLICT DO NOTHING;
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
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_workspace(text,text) TO authenticated;

-- records: scope to workspace
ALTER TABLE public.records ADD COLUMN workspace_id uuid;
DO $$
DECLARE u uuid; w uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.records LOOP
    INSERT INTO public.workspaces(name, owner_id) VALUES ('My Café', u) RETURNING id INTO w;
    INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES (w,u,'owner');
    UPDATE public.records SET workspace_id = w WHERE user_id = u;
  END LOOP;
END $$;
ALTER TABLE public.records DROP CONSTRAINT records_pkey;
ALTER TABLE public.records ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.records ADD PRIMARY KEY (workspace_id, collection, id);
CREATE INDEX records_ws_updated ON public.records(workspace_id, updated_at);

DROP POLICY "own delete" ON public.records;
DROP POLICY "own insert" ON public.records;
DROP POLICY "own select" ON public.records;
DROP POLICY "own update" ON public.records;
CREATE POLICY "ws select" ON public.records FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws insert" ON public.records FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "ws update" ON public.records FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "ws delete" ON public.records FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));