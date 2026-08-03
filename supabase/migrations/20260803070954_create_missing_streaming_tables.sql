/*
# Create missing streaming tables + enable Realtime

## What this does
The app's migration files on disk (program_schedule, live_chat_messages,
vod_assets, vod_access, recording_jobs, user_favorites, user_history,
stream_private_access, pk_battles view) were never applied to the live
database. Only the base tables from 0001_init exist. As a result every
Supabase Realtime WebSocket subscription to `program_schedule` and
`live_chat_messages` fails with CHANNEL_ERROR, which is the root cause
of the continuous console warnings.

This migration creates all missing tables, restores their RLS policies,
creates the helper RPCs the app calls, and adds the streaming tables to
the `supabase_realtime` publication so subscriptions succeed.

## New Tables
1. `program_schedule` — live stream sessions (host, status, category,
   title, cover image, media url, PK flag, private room flag + entry cost).
2. `live_chat_messages` — chat messages attached to a live stream.
3. `vod_assets` — recorded replay videos with paid/public visibility.
4. `vod_access` — per-user purchase records for paid VODs.
5. `recording_jobs` — background recording pipeline jobs.
6. `user_favorites` — viewer follows a host.
7. `user_history` — viewer watch history per stream.
8. `stream_private_access` — per-user private room unlock records.
9. `pk_battles` — compatibility VIEW aliasing `pk_sessions`.

## Security (RLS)
- `program_schedule`: public SELECT (anon+authenticated), host-only
  INSERT/UPDATE/DELETE.
- `live_chat_messages`: public SELECT, authenticated INSERT where
  sender is self.
- `vod_assets`: public SELECT for ready+public/paid rows; host manages own.
- `vod_access`: owner reads own rows.
- `recording_jobs`: host reads/inserts own.
- `user_favorites`: owner CRUD.
- `user_history`: owner read/insert.
- `stream_private_access`: owner read.
All public SELECT policies are scoped `TO anon, authenticated` because
this is a public live-streaming marketplace (no sign-in required to browse).

## Realtime
Adds `program_schedule` and `live_chat_messages` to `supabase_realtime`
so the home grid, sidebar, studio, and chat subscriptions succeed.

## RPCs
- `unlock_private_room(p_stream_id)` — atomically charge tokens and grant
  private room access.
- `purchase_vod_access(p_vod_id)` — atomically charge tokens and grant VOD access.

## Notes
- Uses `IF NOT EXISTS` / `DO $$ ... END $$` guards so it is safe to re-run.
- No existing data is dropped or altered.
- `ensure_wallet` is referenced by the RPCs and already exists in the DB.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. program_schedule
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  category TEXT NOT NULL DEFAULT 'solo',
  is_pk BOOLEAN NOT NULL DEFAULT FALSE,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  private_entry_tokens INT NOT NULL DEFAULT 100,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  media_url TEXT,
  cover_image TEXT,
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_schedule_host ON public.program_schedule(host);
CREATE INDEX IF NOT EXISTS idx_program_schedule_status ON public.program_schedule(status);
CREATE INDEX IF NOT EXISTS idx_program_schedule_category ON public.program_schedule(category);
CREATE INDEX IF NOT EXISTS idx_program_schedule_is_pk ON public.program_schedule(is_pk);
CREATE INDEX IF NOT EXISTS idx_program_schedule_created_at ON public.program_schedule(created_at DESC);

ALTER TABLE public.program_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "program_schedule: read public" ON public.program_schedule;
CREATE POLICY "program_schedule: read public" ON public.program_schedule
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "program_schedule: insert by host" ON public.program_schedule;
CREATE POLICY "program_schedule: insert by host" ON public.program_schedule
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host);

DROP POLICY IF EXISTS "program_schedule: update by host" ON public.program_schedule;
CREATE POLICY "program_schedule: update by host" ON public.program_schedule
  FOR UPDATE TO authenticated USING (auth.uid() = host) WITH CHECK (auth.uid() = host);

DROP POLICY IF EXISTS "program_schedule: delete by host" ON public.program_schedule;
CREATE POLICY "program_schedule: delete by host" ON public.program_schedule
  FOR DELETE TO authenticated USING (auth.uid() = host);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_program_schedule_updated_at ON public.program_schedule;
CREATE TRIGGER update_program_schedule_updated_at
  BEFORE UPDATE ON public.program_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. live_chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.program_schedule(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_stream ON public.live_chat_messages(stream_id, created_at DESC);

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_chat_messages: read public" ON public.live_chat_messages;
CREATE POLICY "live_chat_messages: read public" ON public.live_chat_messages
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "live_chat_messages: insert authenticated" ON public.live_chat_messages;
CREATE POLICY "live_chat_messages: insert authenticated" ON public.live_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- ---------------------------------------------------------------------------
-- 3. user_favorites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, model_id)
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_favorites: read own" ON public.user_favorites;
CREATE POLICY "user_favorites: read own" ON public.user_favorites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_favorites: insert own" ON public.user_favorites;
CREATE POLICY "user_favorites: insert own" ON public.user_favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_favorites: delete own" ON public.user_favorites;
CREATE POLICY "user_favorites: delete own" ON public.user_favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. user_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stream_id UUID NOT NULL REFERENCES public.program_schedule(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_history: read own" ON public.user_history;
CREATE POLICY "user_history: read own" ON public.user_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_history: insert own" ON public.user_history;
CREATE POLICY "user_history: insert own" ON public.user_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. vod_assets + vod_access
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vod_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_stream_id UUID REFERENCES public.program_schedule(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  playback_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INT,
  price_tokens INT NOT NULL DEFAULT 50 CHECK (price_tokens >= 0),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  visibility TEXT NOT NULL DEFAULT 'paid' CHECK (visibility IN ('paid', 'public', 'private')),
  recorded_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vod_assets_host_created ON public.vod_assets(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_assets_status_visibility ON public.vod_assets(status, visibility);

CREATE TABLE IF NOT EXISTS public.vod_access (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vod_id UUID NOT NULL REFERENCES public.vod_assets(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price_tokens INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, vod_id)
);

ALTER TABLE public.vod_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vod_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vod_assets: read ready public_or_paid" ON public.vod_assets;
CREATE POLICY "vod_assets: read ready public_or_paid" ON public.vod_assets
  FOR SELECT TO anon, authenticated
  USING (status = 'ready' AND visibility IN ('public', 'paid'));

DROP POLICY IF EXISTS "vod_assets: host manage own" ON public.vod_assets;
CREATE POLICY "vod_assets: host manage own" ON public.vod_assets
  FOR ALL TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "vod_access: read own" ON public.vod_access;
CREATE POLICY "vod_access: read own" ON public.vod_access
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. recording_jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recording_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.program_schedule(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  input_url TEXT,
  output_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recording_jobs_host_created ON public.recording_jobs(host_id, created_at DESC);

ALTER TABLE public.recording_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recording_jobs: host read own" ON public.recording_jobs;
CREATE POLICY "recording_jobs: host read own" ON public.recording_jobs
  FOR SELECT TO authenticated USING (host_id = auth.uid());

DROP POLICY IF EXISTS "recording_jobs: host insert own" ON public.recording_jobs;
CREATE POLICY "recording_jobs: host insert own" ON public.recording_jobs
  FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. stream_private_access
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stream_private_access (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stream_id UUID NOT NULL REFERENCES public.program_schedule(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price_tokens INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, stream_id)
);

ALTER TABLE public.stream_private_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stream_private_access: read own" ON public.stream_private_access;
CREATE POLICY "stream_private_access: read own" ON public.stream_private_access
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8. pk_battles compatibility view
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'pk_battles'
  ) THEN
    EXECUTE $v$
      CREATE VIEW public.pk_battles AS
      SELECT
        id,
        host_a_id,
        host_b_id,
        score_a AS host_a_score,
        score_b AS host_b_score,
        status,
        created_at,
        starts_at
      FROM public.pk_sessions
    $v$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. RPCs: unlock_private_room + purchase_vod_access
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_private_room(p_stream_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_stream public.program_schedule%rowtype;
  v_wallet uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_stream
  FROM public.program_schedule
  WHERE id = p_stream_id AND status = 'live';

  IF v_stream IS NULL THEN
    RAISE EXCEPTION 'stream_not_live';
  END IF;

  IF COALESCE(v_stream.is_private, false) = false THEN
    RETURN jsonb_build_object('ok', true, 'already_public', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stream_private_access
    WHERE user_id = v_uid AND stream_id = p_stream_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_unlocked', true);
  END IF;

  v_wallet := public.ensure_wallet(v_uid, 'tokens');
  UPDATE public.wallets
    SET balance = balance - v_stream.private_entry_tokens
  WHERE id = v_wallet AND balance >= v_stream.private_entry_tokens;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_tokens';
  END IF;

  INSERT INTO public.stream_private_access (user_id, stream_id, price_tokens)
  VALUES (v_uid, p_stream_id, v_stream.private_entry_tokens);

  INSERT INTO public.ledger_entries (
    event_type, from_user_id, to_user_id, amount_tokens, metadata
  ) VALUES (
    'private_room_unlock', v_uid, v_stream.host, v_stream.private_entry_tokens,
    jsonb_build_object('stream_id', p_stream_id)
  );

  RETURN jsonb_build_object('ok', true, 'price_tokens', v_stream.private_entry_tokens);
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_private_room(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.unlock_private_room(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_vod_access(p_vod_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_vod public.vod_assets%rowtype;
  v_wallet uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_vod
  FROM public.vod_assets
  WHERE id = p_vod_id AND status = 'ready' AND visibility IN ('public', 'paid');

  IF v_vod IS NULL THEN
    RAISE EXCEPTION 'vod_not_available';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vod_access
    WHERE user_id = v_uid AND vod_id = p_vod_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true);
  END IF;

  IF v_vod.visibility = 'public' OR v_vod.price_tokens = 0 THEN
    INSERT INTO public.vod_access (user_id, vod_id, price_tokens)
    VALUES (v_uid, p_vod_id, 0);
    RETURN jsonb_build_object('ok', true, 'price_tokens', 0);
  END IF;

  v_wallet := public.ensure_wallet(v_uid, 'tokens');
  UPDATE public.wallets
    SET balance = balance - v_vod.price_tokens
  WHERE id = v_wallet AND balance >= v_vod.price_tokens;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_tokens';
  END IF;

  INSERT INTO public.vod_access (user_id, vod_id, price_tokens)
  VALUES (v_uid, p_vod_id, v_vod.price_tokens);

  INSERT INTO public.ledger_entries (
    event_type, from_user_id, to_user_id, amount_tokens, metadata
  ) VALUES (
    'vod_purchase', v_uid, v_vod.host_id, v_vod.price_tokens,
    jsonb_build_object('vod_id', p_vod_id)
  );

  RETURN jsonb_build_object('ok', true, 'price_tokens', v_vod.price_tokens);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_vod_access(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.purchase_vod_access(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Realtime publication — add streaming tables
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'program_schedule'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.program_schedule;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'live_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
  END IF;
END $$;
