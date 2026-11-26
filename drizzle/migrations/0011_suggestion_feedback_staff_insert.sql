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
  IF NEW.collection = 'suggestionFeedback' AND TG_OP = 'INSERT' AND NOT NEW.deleted THEN RETURN NEW; END IF;
  IF COALESCE(inv, false) AND NEW.collection IN ('ingredients','purchases','usages') THEN
    IF NEW.deleted THEN RAISE EXCEPTION 'Only the café owner can delete entries'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.collection = 'menuItems' AND TG_OP = 'INSERT' AND NOT NEW.deleted THEN RETURN NEW; END IF;
  IF NEW.collection NOT IN ('batches','sales','wasteLogs','dailyChecks') THEN
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