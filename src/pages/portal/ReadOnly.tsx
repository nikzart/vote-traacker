import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Phone,
  Plane,
  Skull,
  CheckCircle,
  Loader2,
  User,
  Home,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase, getPollingStations } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { cn, getPoliticalLeaningBadgeClasses, formatPhoneNumber } from '@/lib/utils'
import type { Voter, PollingStation } from '@/types'

export default function ReadOnly() {
  const { portalSession } = useAuthStore()

  const [pollingStations, setPollingStations] = useState<PollingStation[]>([])
  const [selectedStation, setSelectedStation] = useState<string>('')
  const [voters, setVoters] = useState<Voter[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<'serial' | 'name'>('serial')
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

  // Load polling stations
  useEffect(() => {
    if (!portalSession) return

    if (portalSession.polling_station_id) {
      setSelectedStation(portalSession.polling_station_id)
    } else if (portalSession.is_master) {
      getPollingStations(portalSession.ward_id).then((stations) => {
        setPollingStations(stations || [])
        if (stations && stations.length > 0) {
          setSelectedStation(stations[0].id)
        }
      })
    }
  }, [portalSession])

  // Search voters
  const searchVoters = useCallback(async () => {
    if (!selectedStation) return

    setLoading(true)
    try {
      let query = supabase
        .from('voters')
        .select('*')
        .eq('polling_station_id', selectedStation)
        .order('serial_no')
        .limit(50)

      if (searchQuery) {
        if (searchType === 'serial') {
          const serialNo = parseInt(searchQuery)
          if (!isNaN(serialNo)) {
            query = query.eq('serial_no', serialNo)
          }
        } else {
          query = query.ilike('name', `%${searchQuery}%`)
        }
      }

      const { data, error } = await query
      if (error) throw error
      setVoters(data || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedStation, searchQuery, searchType])

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchVoters()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchVoters])

  // Realtime subscription
  useEffect(() => {
    if (!selectedStation) return

    const channel = supabase
      .channel('voters-readonly')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'voters',
          filter: `polling_station_id=eq.${selectedStation}`,
        },
        (payload) => {
          setVoters((prev) =>
            prev.map((v) =>
              v.id === (payload.new as Voter).id ? (payload.new as Voter) : v
            )
          )
          if (selectedVoter?.id === (payload.new as Voter).id) {
            setSelectedVoter(payload.new as Voter)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedStation, selectedVoter])

  const handleVoterClick = (voter: Voter) => {
    setSelectedVoter(voter)
    setViewDialogOpen(true)
  }

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          Read Only
        </Badge>
        <span className="text-sm text-muted-foreground">
          View and search voters
        </span>
      </div>

      {/* Polling Station Selector */}
      {portalSession?.is_master && pollingStations.length > 0 && (
        <Select value={selectedStation} onValueChange={setSelectedStation}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select polling station" />
          </SelectTrigger>
          <SelectContent>
            {pollingStations.map((ps) => (
              <SelectItem key={ps.id} value={ps.id}>
                {ps.code} - {ps.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type={searchType === 'serial' ? 'number' : 'text'}
            placeholder={searchType === 'serial' ? 'Serial No.' : 'Search by name...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
        </div>
        <Button
          variant="outline"
          className="h-12 w-12"
          onClick={() => setSearchType(searchType === 'serial' ? 'name' : 'serial')}
        >
          {searchType === 'serial' ? '#' : 'Aa'}
        </Button>
      </div>

      {/* Voter List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : voters.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No voters found</p>
          <p className="text-sm">Try a different search</p>
        </div>
      ) : (
        <div className="space-y-2">
          {voters.map((voter) => (
            <Card
              key={voter.id}
              onClick={() => handleVoterClick(voter)}
              className={cn(
                "cursor-pointer transition-all active:scale-[0.98]",
                voter.has_voted && "bg-green-50 border-green-200",
                voter.is_deceased && "opacity-50"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-primary">
                        #{voter.serial_no}
                      </span>
                      {voter.political_leaning && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            getPoliticalLeaningBadgeClasses(voter.political_leaning)
                          )}
                        >
                          {voter.political_leaning}
                        </Badge>
                      )}
                      {voter.has_voted && (
                        <Badge variant="voted" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" /> Voted
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium truncate">{voter.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {voter.guardian_name} • {voter.house_name}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {voter.is_abroad && (
                        <Badge variant="abroad" className="text-xs">
                          <Plane className="h-3 w-3 mr-1" /> വിദേശത്ത്
                        </Badge>
                      )}
                      {voter.is_deceased && (
                        <Badge variant="deceased" className="text-xs">
                          <Skull className="h-3 w-3 mr-1" /> മരണപ്പെട്ടു
                        </Badge>
                      )}
                    </div>
                  </div>
                  {voter.mobile_number && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-14 w-14 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCall(voter.mobile_number!)
                      }}
                    >
                      <Phone className="h-6 w-6 text-green-600" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-primary">#{selectedVoter?.serial_no}</span>
              {selectedVoter?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedVoter && (
            <div className="space-y-4 py-4">
              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                {selectedVoter.political_leaning && (
                  <Badge
                    variant="outline"
                    className={getPoliticalLeaningBadgeClasses(selectedVoter.political_leaning)}
                  >
                    {selectedVoter.political_leaning}
                  </Badge>
                )}
                {selectedVoter.has_voted && (
                  <Badge variant="voted">
                    <CheckCircle className="h-3 w-3 mr-1" /> Voted
                  </Badge>
                )}
                {selectedVoter.is_abroad && (
                  <Badge variant="abroad">
                    <Plane className="h-3 w-3 mr-1" /> വിദേശത്ത്
                  </Badge>
                )}
                {selectedVoter.is_deceased && (
                  <Badge variant="deceased">
                    <Skull className="h-3 w-3 mr-1" /> മരണപ്പെട്ടു
                  </Badge>
                )}
              </div>

              {/* Voter Details */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Guardian</p>
                    <p className="font-medium">{selectedVoter.guardian_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{selectedVoter.house_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedVoter.house_no}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Details</p>
                    <p className="font-medium">
                      {selectedVoter.gender === 'M' ? 'Male' : 'Female'}, {selectedVoter.age} years
                    </p>
                    <p className="text-sm text-muted-foreground">
                      SEC ID: {selectedVoter.sec_id}
                    </p>
                  </div>
                </div>

                {selectedVoter.mobile_number && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Phone className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Mobile</p>
                      <p className="font-medium">
                        {formatPhoneNumber(selectedVoter.mobile_number)}
                      </p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleCall(selectedVoter.mobile_number!)}
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
