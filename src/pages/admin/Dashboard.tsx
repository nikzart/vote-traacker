import { useState, useEffect } from 'react'
import { Users, CheckCircle, Plane, Skull, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { supabase, getDistricts, getLocalBodies, getWards } from '@/lib/supabase'
import { calculatePercentage } from '@/lib/utils'
import type { District, LocalBody, Ward, VotingStats } from '@/types'

const COLORS = {
  UDF: '#22c55e',
  LDF: '#ef4444',
  NDA: '#f97316',
  Other: '#a855f7',
  Neutral: '#6b7280',
}

interface StatsCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon: React.ReactNode
  color?: string
}

function StatsCard({ title, value, subtitle, icon, color = 'text-primary' }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={color}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminDashboard() {
  const [districts, setDistricts] = useState<District[]>([])
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  const [selectedDistrict, setSelectedDistrict] = useState<string>('')
  const [selectedLocalBody, setSelectedLocalBody] = useState<string>('')
  const [selectedWard, setSelectedWard] = useState<string>('')
  const [stats, setStats] = useState<VotingStats | null>(null)
  const [wardProgress, setWardProgress] = useState<Array<{ name: string; voted: number; total: number; percentage: number }>>([])
  const [loading, setLoading] = useState(true)

  // Fetch districts on mount
  useEffect(() => {
    getDistricts().then(setDistricts)
  }, [])

  // Fetch local bodies when district changes
  useEffect(() => {
    if (selectedDistrict) {
      getLocalBodies(selectedDistrict).then(setLocalBodies)
      setSelectedLocalBody('')
      setSelectedWard('')
    } else {
      setLocalBodies([])
    }
  }, [selectedDistrict])

  // Fetch wards when local body changes
  useEffect(() => {
    if (selectedLocalBody) {
      getWards(selectedLocalBody).then(setWards)
      setSelectedWard('')
    } else {
      setWards([])
    }
  }, [selectedLocalBody])

  // Fetch stats
  const fetchStats = async () => {
    setLoading(true)
    try {
      // Get all voters with filters
      let query = supabase
        .from('voters')
        .select(`
          political_leaning,
          is_abroad,
          is_deceased,
          has_voted,
          polling_station:polling_stations!inner(
            ward:wards!inner(
              id,
              name,
              local_body:local_bodies!inner(
                district_id
              )
            )
          )
        `)

      if (selectedWard) {
        query = query.eq('polling_station.ward_id', selectedWard)
      } else if (selectedLocalBody) {
        query = query.eq('polling_station.ward.local_body_id', selectedLocalBody)
      } else if (selectedDistrict) {
        query = query.eq('polling_station.ward.local_body.district_id', selectedDistrict)
      }

      const { data, error } = await query

      if (error) throw error

      // Calculate stats
      const statsData: VotingStats = {
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
      setStats(statsData)

      // Calculate ward progress
      if (data && data.length > 0) {
        const wardMap = new Map<string, { name: string; voted: number; total: number }>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.forEach((voter: any) => {
          const pollingStation = Array.isArray(voter.polling_station)
            ? voter.polling_station[0]
            : voter.polling_station
          const ward = Array.isArray(pollingStation?.ward)
            ? pollingStation?.ward[0]
            : pollingStation?.ward
          if (ward) {
            const existing = wardMap.get(ward.id) || { name: ward.name, voted: 0, total: 0 }
            existing.total++
            if (voter.has_voted) existing.voted++
            wardMap.set(ward.id, existing)
          }
        })
        const progress = Array.from(wardMap.values())
          .map(w => ({
            name: w.name.length > 15 ? w.name.substring(0, 15) + '...' : w.name,
            voted: w.voted,
            total: w.total,
            percentage: calculatePercentage(w.voted, w.total),
          }))
          .sort((a, b) => b.percentage - a.percentage)
          .slice(0, 10)
        setWardProgress(progress)
      } else {
        setWardProgress([])
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [selectedDistrict, selectedLocalBody, selectedWard])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('voters-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voters' },
        () => {
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDistrict, selectedLocalBody, selectedWard])

  const pieData = stats ? [
    { name: 'UDF', value: stats.udf_count, color: COLORS.UDF },
    { name: 'LDF', value: stats.ldf_count, color: COLORS.LDF },
    { name: 'NDA', value: stats.nda_count, color: COLORS.NDA },
    { name: 'Other', value: stats.other_count, color: COLORS.Other },
    { name: 'Neutral', value: stats.neutral_count, color: COLORS.Neutral },
  ].filter(d => d.value > 0) : []

  const votedPercentage = stats ? calculatePercentage(stats.voted_count, stats.total_voters) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Real-time voting analytics</p>
        </div>
        <Button variant="outline" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">District</label>
              <Select value={selectedDistrict || '__all__'} onValueChange={(v) => setSelectedDistrict(v === '__all__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Districts</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Local Body</label>
              <Select
                value={selectedLocalBody || '__all__'}
                onValueChange={(v) => setSelectedLocalBody(v === '__all__' ? '' : v)}
                disabled={!selectedDistrict}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Local Bodies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Local Bodies</SelectItem>
                  {localBodies.map((lb) => (
                    <SelectItem key={lb.id} value={lb.id}>
                      {lb.name} ({lb.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Ward</label>
              <Select
                value={selectedWard || '__all__'}
                onValueChange={(v) => setSelectedWard(v === '__all__' ? '' : v)}
                disabled={!selectedLocalBody}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Wards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Wards</SelectItem>
                  {wards.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Voters"
          value={stats?.total_voters.toLocaleString() || '0'}
          icon={<Users className="h-5 w-5" />}
        />
        <StatsCard
          title="Voted"
          value={stats?.voted_count.toLocaleString() || '0'}
          subtitle={`${votedPercentage}% turnout`}
          icon={<CheckCircle className="h-5 w-5" />}
          color="text-green-600"
        />
        <StatsCard
          title="Abroad"
          value={stats?.abroad_count.toLocaleString() || '0'}
          icon={<Plane className="h-5 w-5" />}
          color="text-yellow-600"
        />
        <StatsCard
          title="Deceased"
          value={stats?.deceased_count.toLocaleString() || '0'}
          icon={<Skull className="h-5 w-5" />}
          color="text-gray-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Political Leaning Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Political Leaning Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No political leaning data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ward Progress Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ward-wise Voting Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {wardProgress.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={wardProgress} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'percentage' ? `${value}%` : value,
                      name === 'percentage' ? 'Turnout' : name
                    ]}
                  />
                  <Bar dataKey="percentage" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No ward data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
