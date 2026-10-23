CREATE OR REPLACE FUNCTION public.enforce_record_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text; latest text;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT role INTO r FROM public.workspace_members
   WHERE workspace_id = COALESCE(NEW.workspace_id, OLD.workspace_id) AND user_id = auth.uid();
  IF r = 'owner' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Only the café owner can delete entries'; END IF;
  IF NEW.collection = 'changeLogs' THEN RETURN NEW; END IF;
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

DROP TRIGGER IF EXISTS records_role_guard ON public.records;
CREATE TRIGGER records_role_guard BEFORE INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.enforce_record_role();