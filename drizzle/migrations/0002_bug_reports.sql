CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  reporter_name text,
  reporter_email text,
  title text NOT NULL,
  description text NOT NULL,
  page text,
  user_agent text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own reports" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND char_length(title) <= 200 AND char_length(description) <= 5000);
CREATE POLICY "read own reports" ON public.bug_reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin updates reports" ON public.bug_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));