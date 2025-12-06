// Database types
export interface District {
  id: string
  name: string
  created_at: string
}

export interface LocalBody {
  id: string
  district_id: string
  name: string
  code: string
  created_at: string
  district?: District
}

export interface Ward {
  id: string
  local_body_id: string
  name: string
  ward_number: string
  created_at: string
  local_body?: LocalBody
}

export interface PollingStation {
  id: string
  ward_id: string
  name: string
  code: string
  created_at: string
  ward?: Ward
}

export interface WardCredential {
  id: string
  ward_id: string
  polling_station_id: string | null
  username: string
  password_hash: string
  is_master: boolean
  is_active: boolean
  is_view_only: boolean
  created_at: string
  ward?: Ward
  polling_station?: PollingStation
}

export type PoliticalLeaning = 'UDF' | 'LDF' | 'NDA' | 'Other' | 'Neutral' | null

export interface Voter {
  id: string
  polling_station_id: string
  serial_no: number
  name: string
  guardian_name: string | null
  house_no: string | null
  house_name: string | null
  gender: 'M' | 'F' | null
  age: number | null
  sec_id: string | null
  political_leaning: PoliticalLeaning
  mobile_number: string | null
  is_abroad: boolean
  is_deceased: boolean
  has_voted: boolean
  updated_at: string
  polling_station?: PollingStation
}

export interface VoterGroup {
  id: string
  ward_id: string
  name: string
  group_type: 'family' | 'custom'
  created_at: string
}

export interface VoterGroupMember {
  id: string
  group_id: string
  voter_id: string
  voter?: Voter
}

export interface AdminUser {
  id: string
  email: string
  is_super_admin: boolean
  created_at: string
}

// JSON Import types (matching the provided JSON structure)
export interface ImportedVoter {
  'Serial No.': string
  'Name': string
  "Guardian's Name": string
  'OldWard No/ House No.': string
  'House Name': string
  'Gender': string
  'Age': string
  'New SEC ID No.': string
}

export interface ImportedData {
  'District': string
  'Local Body': string
  'Local Body Code': string
  'Ward': string
  'Ward Number': string
  'Polling Station': string
  'Polling Station Code': string
  'voters': ImportedVoter[]
}

// Auth types
export interface PortalSession {
  credential_id: string
  ward_id: string
  polling_station_id: string | null
  is_master: boolean
  is_view_only: boolean
  username: string
}

// Stats types
export interface VotingStats {
  total_voters: number
  voted_count: number
  abroad_count: number
  deceased_count: number
  udf_count: number
  ldf_count: number
  nda_count: number
  other_count: number
  neutral_count: number
}

export interface WardProgress {
  ward_id: string
  ward_name: string
  local_body_name: string
  total_voters: number
  voted_count: number
  percentage: number
}

// UI types
export interface TreeNode {
  id: string
  name: string
  code?: string
  type: 'district' | 'local_body' | 'ward' | 'polling_station'
  children?: TreeNode[]
  data?: District | LocalBody | Ward | PollingStation
}
