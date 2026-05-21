-- =============================================
-- STRESS INDEX — Migrazione organizzazioni
-- Owner crea organizzazione, invita professionisti,
-- ha accesso READ-ONLY ai dati dei membri.
-- Eseguire su Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- L'owner può fare tutto sulla sua org
DROP POLICY IF EXISTS "org_owner_all" ON organizations;
CREATE POLICY "org_owner_all" ON organizations
  FOR ALL USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id)
    ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  invited_by UUID NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- I membri possono leggere la propria org
DROP POLICY IF EXISTS "org_member_read" ON organizations;
CREATE POLICY "org_member_read" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Owner e admin vedono tutti i membri della propria org;
-- ogni utente vede la propria riga (per scoprire inviti pendenti)
DROP POLICY IF EXISTS "members_org_read" ON organization_members;
CREATE POLICY "members_org_read" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members m2
      WHERE m2.user_id = auth.uid()
      AND m2.role IN ('owner', 'admin')
      AND m2.status = 'active'
    )
    OR user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Owner può inserire e aggiornare membri della propria org
DROP POLICY IF EXISTS "members_owner_write" ON organization_members;
CREATE POLICY "members_owner_write" ON organization_members
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM organizations
      WHERE owner_id = auth.uid()
    )
  );

-- Aggiungi organization_id ai profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  organization_id UUID REFERENCES organizations(id);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_profiles_org
  ON profiles(organization_id) WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_org
  ON organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_org_members_email
  ON organization_members(email);

-- ============================================================================
-- RLS aggiuntive per permettere all'owner di LEGGERE clienti e sessioni dei membri
-- ============================================================================

-- Policy READ su clients per owner organizzazione
DROP POLICY IF EXISTS "clients_org_owner_read" ON clients;
CREATE POLICY "clients_org_owner_read" ON clients
  FOR SELECT USING (
    professionista_id IN (
      SELECT p.id FROM profiles p
      WHERE p.organization_id = (
        SELECT p2.organization_id FROM profiles p2
        WHERE p2.id = auth.uid()
      )
      AND (
        SELECT role FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id = p.organization_id
        AND om.status = 'active'
      ) IN ('owner', 'admin')
    )
  );

-- Policy READ su sessions per owner organizzazione
DROP POLICY IF EXISTS "sessions_org_owner_read" ON sessions;
CREATE POLICY "sessions_org_owner_read" ON sessions
  FOR SELECT USING (
    professionista_id IN (
      SELECT p.id FROM profiles p
      WHERE p.organization_id = (
        SELECT p2.organization_id FROM profiles p2
        WHERE p2.id = auth.uid()
      )
      AND (
        SELECT role FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id = p.organization_id
        AND om.status = 'active'
      ) IN ('owner', 'admin')
    )
  );

-- Policy READ su client_notes per owner organizzazione
DROP POLICY IF EXISTS "notes_org_owner_read" ON client_notes;
CREATE POLICY "notes_org_owner_read" ON client_notes
  FOR SELECT USING (
    professionista_id IN (
      SELECT p.id FROM profiles p
      WHERE p.organization_id = (
        SELECT p2.organization_id FROM profiles p2
        WHERE p2.id = auth.uid()
      )
      AND (
        SELECT role FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id = p.organization_id
        AND om.status = 'active'
      ) IN ('owner', 'admin')
    )
  );

-- Policy READ su measurement_analytics per owner organizzazione
DROP POLICY IF EXISTS "analytics_org_owner_read" ON measurement_analytics;
CREATE POLICY "analytics_org_owner_read" ON measurement_analytics
  FOR SELECT USING (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.organization_id = (
        SELECT p2.organization_id FROM profiles p2
        WHERE p2.id = auth.uid()
      )
      AND (
        SELECT role FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id = p.organization_id
        AND om.status = 'active'
      ) IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- RPC per accettare invito
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_organization_invite(
  p_invite_id UUID
) RETURNS VOID AS $$
DECLARE
  v_org_id UUID;
  v_email TEXT;
BEGIN
  -- Verifica che l'invito sia per l'utente corrente
  SELECT om.organization_id, om.email INTO v_org_id, v_email
  FROM organization_members om
  WHERE om.id = p_invite_id
    AND om.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invito non trovato o già accettato';
  END IF;

  -- Verifica che l'email corrisponda
  IF v_email != (SELECT email FROM auth.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Questo invito non è per il tuo account';
  END IF;

  -- Aggiorna il membro
  UPDATE organization_members
  SET user_id = auth.uid(),
      status = 'active',
      accepted_at = now()
  WHERE id = p_invite_id;

  -- Collega il profilo all'organizzazione
  UPDATE profiles
  SET organization_id = v_org_id
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
