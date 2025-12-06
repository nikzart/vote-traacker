-- Vote Tracker Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Districts Table
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Local Bodies Table
CREATE TABLE IF NOT EXISTS local_bodies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id UUID REFERENCES districts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(district_id, code)
);

-- 3. Wards Table
CREATE TABLE IF NOT EXISTS wards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_body_id UUID REFERENCES local_bodies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  ward_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(local_body_id, ward_number)
);

-- 4. Polling Stations Table
CREATE TABLE IF NOT EXISTS polling_stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_id UUID REFERENCES wards(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ward_id, code)
);

-- 5. Ward Credentials Table (for Portal Auth)
CREATE TABLE IF NOT EXISTS ward_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_id UUID REFERENCES wards(id) ON DELETE CASCADE NOT NULL,
  polling_station_id UUID REFERENCES polling_stations(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_master BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Voters Table
CREATE TABLE IF NOT EXISTS voters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  polling_station_id UUID REFERENCES polling_stations(id) ON DELETE CASCADE NOT NULL,
  serial_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  guardian_name TEXT,
  house_no TEXT,
  house_name TEXT,
  gender TEXT CHECK (gender IN ('M', 'F')),
  age INTEGER,
  sec_id TEXT,
  political_leaning TEXT CHECK (political_leaning IN ('UDF', 'LDF', 'NDA', 'Other', 'Neutral')),
  mobile_number TEXT,
  is_abroad BOOLEAN DEFAULT FALSE,
  is_deceased BOOLEAN DEFAULT FALSE,
  has_voted BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(polling_station_id, serial_no)
);

-- 7. Voter Groups Table
CREATE TABLE IF NOT EXISTS voter_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_id UUID REFERENCES wards(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  group_type TEXT DEFAULT 'family' CHECK (group_type IN ('family', 'custom')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Voter Group Members Table
CREATE TABLE IF NOT EXISTS voter_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES voter_groups(id) ON DELETE CASCADE NOT NULL,
  voter_id UUID REFERENCES voters(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(group_id, voter_id)
);

-- 9. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_super_admin BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voters_polling_station ON voters(polling_station_id);
CREATE INDEX IF NOT EXISTS idx_voters_serial_no ON voters(polling_station_id, serial_no);
CREATE INDEX IF NOT EXISTS idx_voters_name ON voters USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_voters_has_voted ON voters(has_voted);
CREATE INDEX IF NOT EXISTS idx_local_bodies_district ON local_bodies(district_id);
CREATE INDEX IF NOT EXISTS idx_wards_local_body ON wards(local_body_id);
CREATE INDEX IF NOT EXISTS idx_polling_stations_ward ON polling_stations(ward_id);
CREATE INDEX IF NOT EXISTS idx_ward_credentials_ward ON ward_credentials(ward_id);
CREATE INDEX IF NOT EXISTS idx_voter_groups_ward ON voter_groups(ward_id);
CREATE INDEX IF NOT EXISTS idx_voter_group_members_group ON voter_group_members(group_id);

-- Enable Row Level Security (optional - for production)
-- ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE local_bodies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE polling_stations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ward_credentials ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE voter_groups ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE voter_group_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (development mode)
-- In production, add proper RLS policies

-- Enable Realtime for voters table
ALTER PUBLICATION supabase_realtime ADD TABLE voters;

-- Create a default admin user (change password in production!)
INSERT INTO admin_users (email, password_hash, is_super_admin)
VALUES ('admin@votetracker.com', 'admin123', true)
ON CONFLICT (email) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for voters table
DROP TRIGGER IF EXISTS update_voters_updated_at ON voters;
CREATE TRIGGER update_voters_updated_at
    BEFORE UPDATE ON voters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
