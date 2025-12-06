import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Database helper functions
export async function getDistricts() {
  const { data, error } = await supabase
    .from('districts')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function getLocalBodies(districtId?: string) {
  let query = supabase
    .from('local_bodies')
    .select('*, district:districts(*)')
    .order('name')

  if (districtId) {
    query = query.eq('district_id', districtId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getWards(localBodyId?: string) {
  let query = supabase
    .from('wards')
    .select('*, local_body:local_bodies(*, district:districts(*))')
    .order('name')

  if (localBodyId) {
    query = query.eq('local_body_id', localBodyId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getPollingStations(wardId?: string) {
  let query = supabase
    .from('polling_stations')
    .select('*, ward:wards(*, local_body:local_bodies(*, district:districts(*)))')
    .order('code')

  if (wardId) {
    query = query.eq('ward_id', wardId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getVoters(pollingStationId: string, options?: {
  search?: string
  serialNo?: number
  offset?: number
  limit?: number
}) {
  let query = supabase
    .from('voters')
    .select('*', { count: 'exact' })
    .eq('polling_station_id', pollingStationId)
    .order('serial_no')

  if (options?.serialNo) {
    query = query.eq('serial_no', options.serialNo)
  } else if (options?.search) {
    query = query.ilike('name', `%${options.search}%`)
  }

  if (options?.offset !== undefined) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function getVotersByWard(wardId: string, options?: {
  search?: string
  serialNo?: number
  pollingStationId?: string
}) {
  const { data: stations } = await supabase
    .from('polling_stations')
    .select('id')
    .eq('ward_id', wardId)

  if (!stations || stations.length === 0) return { data: [], count: 0 }

  const stationIds = options?.pollingStationId
    ? [options.pollingStationId]
    : stations.map(s => s.id)

  let query = supabase
    .from('voters')
    .select('*, polling_station:polling_stations(*)', { count: 'exact' })
    .in('polling_station_id', stationIds)
    .order('serial_no')

  if (options?.serialNo) {
    query = query.eq('serial_no', options.serialNo)
  } else if (options?.search) {
    query = query.ilike('name', `%${options.search}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function updateVoter(voterId: string, updates: Partial<{
  political_leaning: string | null
  mobile_number: string | null
  is_abroad: boolean
  is_deceased: boolean
  has_voted: boolean
}>) {
  const { data, error } = await supabase
    .from('voters')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', voterId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getWardCredentials(wardId?: string) {
  let query = supabase
    .from('ward_credentials')
    .select('*, ward:wards(*), polling_station:polling_stations(*)')
    .order('created_at', { ascending: false })

  if (wardId) {
    query = query.eq('ward_id', wardId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function verifyPortalCredentials(username: string, password: string) {
  // First get the credential
  const { data: credential, error } = await supabase
    .from('ward_credentials')
    .select('*, ward:wards(*), polling_station:polling_stations(*)')
    .eq('username', username)
    .eq('is_active', true)
    .single()

  if (error || !credential) {
    throw new Error('Invalid credentials')
  }

  // For simplicity, we store passwords in plain text (in production, use proper hashing)
  // The password_hash field stores the plain password for this demo
  if (credential.password_hash !== password) {
    throw new Error('Invalid credentials')
  }

  return credential
}

export async function getVotingStats(filters?: {
  districtId?: string
  localBodyId?: string
  wardId?: string
  pollingStationId?: string
}) {
  // Build the query based on filters
  let query = supabase
    .from('voters')
    .select('political_leaning, is_abroad, is_deceased, has_voted, polling_station:polling_stations!inner(ward:wards!inner(local_body:local_bodies!inner(district_id)))')

  // Apply filters through joins
  if (filters?.pollingStationId) {
    query = query.eq('polling_station_id', filters.pollingStationId)
  } else if (filters?.wardId) {
    query = query.eq('polling_station.ward_id', filters.wardId)
  } else if (filters?.localBodyId) {
    query = query.eq('polling_station.ward.local_body_id', filters.localBodyId)
  } else if (filters?.districtId) {
    query = query.eq('polling_station.ward.local_body.district_id', filters.districtId)
  }

  const { data, error } = await query
  if (error) throw error

  // Calculate stats
  const stats = {
    total_voters: data?.length || 0,
    voted_count: data?.filter(v => v.has_voted).length || 0,
    abroad_count: data?.filter(v => v.is_abroad).length || 0,
    deceased_count: data?.filter(v => v.is_deceased).length || 0,
    udf_count: data?.filter(v => v.political_leaning === 'UDF').length || 0,
    ldf_count: data?.filter(v => v.political_leaning === 'LDF').length || 0,
    nda_count: data?.filter(v => v.political_leaning === 'NDA').length || 0,
    other_count: data?.filter(v => v.political_leaning === 'Other').length || 0,
    neutral_count: data?.filter(v => v.political_leaning === 'Neutral').length || 0,
  }

  return stats
}

// Voter Groups
export async function getVoterGroups(wardId: string) {
  const { data, error } = await supabase
    .from('voter_groups')
    .select('*')
    .eq('ward_id', wardId)
    .order('name')

  if (error) throw error
  return data
}

export async function createVoterGroup(wardId: string, name: string, groupType: 'family' | 'custom') {
  const { data, error } = await supabase
    .from('voter_groups')
    .insert({ ward_id: wardId, name, group_type: groupType })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from('voter_group_members')
    .select('*, voter:voters(*)')
    .eq('group_id', groupId)

  if (error) throw error
  return data
}

export async function addVoterToGroup(groupId: string, voterId: string) {
  const { data, error } = await supabase
    .from('voter_group_members')
    .insert({ group_id: groupId, voter_id: voterId })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function removeVoterFromGroup(groupId: string, voterId: string) {
  const { error } = await supabase
    .from('voter_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('voter_id', voterId)

  if (error) throw error
}

export async function deleteVoterGroup(groupId: string) {
  const { error } = await supabase
    .from('voter_groups')
    .delete()
    .eq('id', groupId)

  if (error) throw error
}

export async function getVoterGroupMembership(voterId: string, wardId: string) {
  const { data, error } = await supabase
    .from('voter_group_members')
    .select('*, voter_group:voter_groups!inner(*)')
    .eq('voter_id', voterId)
    .eq('voter_group.ward_id', wardId)

  if (error) throw error
  return data
}
