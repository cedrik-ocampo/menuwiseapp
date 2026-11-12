ALTER TABLE public.workspace_members ADD COLUMN inventory_access boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_member_inventory_access(_ws uuid, _user uuid, _on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_workspace_owner(_ws, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only the café owner can change staff permissions';
  END IF;
  UPDATE public.workspace_members SET inventory_access = _on
   WHERE workspace_id = _ws AND user_id = _user AND role = 'staff';
END $$;
REVOKE ALL ON FUNCTION public.set_member_inventory_access(uuid, uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_member_inventory_access(uuid, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_record_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text; inv boolean; latest text;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT role, inventory_access INTO r, inv FROM public.workspace_members
   WHERE workspace_id = COALESCE(NEW.workspace_id, OLD.workspace_id) AND user_id = auth.uid();
  IF r = 'owner' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Only the café owner can delete entries'; END IF;
  IF NEW.collection = 'changeLogs' THEN RETURN NEW; END IF;
  -- Staff with inventory access may add and update stock (never delete).
  IF COALESCE(inv, false) AND NEW.collection IN ('ingredients','purchases','usages') THEN
    IF NEW.deleted THEN RAISE EXCEPTION 'Only the café owner can delete entries'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.collection = 'menuItems' AND TG_OP = 'INSERT' AND NOT NEW.deleted THEN RETURN NEW; END IF;
  IF NEW.collection NOT IN ('batches','sales','wasteLogs') THEN
    RAISE EXCEPTION 'Only the café owner can change café setup';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.deleted THEN RAISE EXCEPTION 'Only the café owner can delete entries'; END IF;
    SELECT id INTO latest FROM public.records
     WHERE workspace_id = OLD.workspace_id AND collection = OLD.collection
       AND NOT deleted AND data->>'createdBy' = auth.uid()::text
     ORDER BY data->>'createdAt' DESC, id DESC LIMIT 1;
    IF latest IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Employees can edit only their own latest entry';
    END IF;
  END IF;
  RETURN NEW;
END $$;