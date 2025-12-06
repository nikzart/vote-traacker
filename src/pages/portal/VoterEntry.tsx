import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Phone,
  Plane,
  Skull,
  CheckCircle,
  Loader2,
  Filter,
  X,
  Check,
  Save,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase, getPollingStations, updateVoter } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { cn, getPoliticalLeaningBadgeClasses } from '@/lib/utils'
import AddToGroupDialog from '@/components/portal/AddToGroupDialog'
import type { Voter, PollingStation, PoliticalLeaning } from '@/types'

// Voter entry component with call button and vote toggle
export default function VoterEntry() {
  const { portalSession } = useAuthStore()
  const { showToast } = useUIStore()
  const isViewOnly = portalSession?.is_view_only ?? false

  const [pollingStations, setPollingStations] = useState<PollingStation[]>([])
  const [selectedStation, setSelectedStation] = useState<string>('')
  const [voters, setVoters] = useState<Voter[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null)
  const [editedVoter, setEditedVoter] = useState<Partial<Voter>>({})
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [voteConfirmVoter, setVoteConfirmVoter] = useState<Voter | null>(null)
  const [filters, setFilters] = useState({
    hasVoted: '' as '' | 'yes' | 'no',
    politicalLeaning: '' as PoliticalLeaning | '',
  })
  const [groupDialogVoter, setGroupDialogVoter] = useState<Voter | null>(null)

  // Load polling stations
  useEffect(() => {
    if (!portalSession) return

    if (portalSession.polling_station_id) {
      // Non-master: single polling station
      setSelectedStation(portalSession.polling_station_id)
    } else if (portalSession.is_master) {
      // Master: load all polling stations in ward
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
        const serialNo = parseInt(searchQuery)
        if (!isNaN(serialNo)) {
          query = query.eq('serial_no', serialNo)
        }
      }

      // Apply filters
      if (filters.hasVoted === 'yes') {
        query = query.eq('has_voted', true)
      } else if (filters.hasVoted === 'no') {
        query = query.eq('has_voted', false)
      }

      if (filters.politicalLeaning) {
        query = query.eq('political_leaning', filters.politicalLeaning)
      }

      const { data, error } = await query

      if (error) throw error
      setVoters(data || [])
    } catch (error) {
      console.error('Search error:', error)
      showToast('error', 'Failed to search voters')
    } finally {
      setLoading(false)
    }
  }, [selectedStation, searchQuery, filters, showToast])

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
      .channel('voters-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voters',
          filter: `polling_station_id=eq.${selectedStation}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setVoters((prev) =>
              prev.map((v) =>
                v.id === (payload.new as Voter).id ? (payload.new as Voter) : v
              )
            )
            // Update selected voter if it's the one being edited
            if (selectedVoter?.id === (payload.new as Voter).id) {
              setSelectedVoter(payload.new as Voter)
            }
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
    setEditedVoter({
      political_leaning: voter.political_leaning,
      mobile_number: voter.mobile_number,
      is_abroad: voter.is_abroad,
      is_deceased: voter.is_deceased,
      has_voted: voter.has_voted,
    })
    setEditDialogOpen(true)
  }

  const handleEditChange = (field: keyof Voter, value: unknown) => {
    setEditedVoter((prev) => ({ ...prev, [field]: value }))
  }

  const hasChanges = selectedVoter && (
    editedVoter.political_leaning !== selectedVoter.political_leaning ||
    editedVoter.mobile_number !== selectedVoter.mobile_number ||
    editedVoter.is_abroad !== selectedVoter.is_abroad ||
    editedVoter.is_deceased !== selectedVoter.is_deceased ||
    editedVoter.has_voted !== selectedVoter.has_voted
  )

  const handleSaveChanges = async () => {
    if (!selectedVoter || !hasChanges) return

    setSaving(true)
    try {
      await updateVoter(selectedVoter.id, editedVoter)
      showToast('success', 'Changes saved successfully')
      setEditDialogOpen(false)
    } catch {
      showToast('error', 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscardChanges = () => {
    if (selectedVoter) {
      setEditedVoter({
        political_leaning: selectedVoter.political_leaning,
        mobile_number: selectedVoter.mobile_number,
        is_abroad: selectedVoter.is_abroad,
        is_deceased: selectedVoter.is_deceased,
        has_voted: selectedVoter.has_voted,
      })
    }
  }

  const handleQuickVote = (voter: Voter, e: React.MouseEvent) => {
    e.stopPropagation()
    setVoteConfirmVoter(voter)
  }

  const confirmVote = async () => {
    if (!voteConfirmVoter) return
    try {
      await updateVoter(voteConfirmVoter.id, { has_voted: true })
      showToast('success', 'Marked as voted')
    } catch {
      showToast('error', 'Failed to update')
    } finally {
      setVoteConfirmVoter(null)
    }
  }

  const activeFiltersCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Polling Station Selector (for master users) */}
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

      {/* Search Bar - Sticky */}
      <div className="sticky top-14 z-30 bg-gray-50 py-2 -mx-4 px-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="number"
              placeholder="Serial No."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>
          <Button
            variant="outline"
            className={cn("h-12 w-12 relative", activeFiltersCount > 0 && "text-primary")}
            onClick={() => setFilterOpen(true)}
          >
            <Filter className="h-5 w-5" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>
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
                "transition-all",
                !isViewOnly && "cursor-pointer active:scale-[0.98]",
                voter.has_voted && "bg-green-50 border-green-200",
                voter.is_deceased && "opacity-50"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
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
                  <div className="flex gap-2 flex-shrink-0">
                    {voter.mobile_number && (
                      <button
                        type="button"
                        className="h-12 w-12 rounded-xl bg-green-50 border border-green-200 hover:bg-green-100 flex items-center justify-center transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`tel:${voter.mobile_number}`)
                        }}
                      >
                        <Phone className="h-5 w-5 stroke-green-600" strokeWidth={2} />
                      </button>
                    )}
                    {!isViewOnly && !voter.has_voted && (
                      <button
                        type="button"
                        className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 flex items-center justify-center transition-colors"
                        onClick={(e) => handleQuickVote(voter, e)}
                      >
                        <CheckCircle className="h-5 w-5 stroke-blue-600" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto [&>button]:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle>
              #{selectedVoter?.serial_no} - {selectedVoter?.name}
            </DialogTitle>
            <button
              onClick={() => setEditDialogOpen(false)}
              className="p-2 rounded-lg border opacity-70 hover:opacity-100 hover:bg-muted transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {selectedVoter && (
            <div className="space-y-6 py-4">
              {/* Voter Info */}
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <p><strong>Guardian:</strong> {selectedVoter.guardian_name}</p>
                <p><strong>House:</strong> {selectedVoter.house_name} ({selectedVoter.house_no})</p>
                <p><strong>Gender:</strong> {selectedVoter.gender === 'M' ? 'Male' : 'Female'}</p>
                <p><strong>Age:</strong> {selectedVoter.age}</p>
                <p><strong>SEC ID:</strong> {selectedVoter.sec_id}</p>
              </div>

              {!isViewOnly && (
                <>
                  {/* Political Leaning */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Political Leaning</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {['UDF', 'LDF', 'NDA', 'Other', 'Neutral'].map((option) => {
                        const isSelected = editedVoter.political_leaning === option
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleEditChange('political_leaning', isSelected ? null : option)}
                            className={cn(
                              "relative flex items-center justify-center px-3 py-3 border-2 rounded-lg cursor-pointer transition-all font-medium",
                              isSelected ? [
                                "ring-2 ring-offset-2",
                                option === 'UDF' && "bg-green-100 border-green-500 text-green-700 ring-green-500",
                                option === 'LDF' && "bg-red-100 border-red-500 text-red-700 ring-red-500",
                                option === 'NDA' && "bg-orange-100 border-orange-500 text-orange-700 ring-orange-500",
                                option === 'Other' && "bg-purple-100 border-purple-500 text-purple-700 ring-purple-500",
                                option === 'Neutral' && "bg-gray-100 border-gray-500 text-gray-700 ring-gray-500",
                              ] : [
                                "border-gray-200 hover:border-gray-300 bg-white",
                                option === 'UDF' && "hover:bg-green-50 text-green-600",
                                option === 'LDF' && "hover:bg-red-50 text-red-600",
                                option === 'NDA' && "hover:bg-orange-50 text-orange-600",
                                option === 'Other' && "hover:bg-purple-50 text-purple-600",
                                option === 'Neutral' && "hover:bg-gray-50 text-gray-600",
                              ]
                            )}
                          >
                            {isSelected && (
                              <Check className="absolute top-1 right-1 h-4 w-4" />
                            )}
                            {option}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Mobile Number</Label>
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder="Enter mobile number"
                        value={editedVoter.mobile_number || ''}
                        onChange={(e) => handleEditChange('mobile_number', e.target.value || null)}
                        className="h-12"
                      />
                      {editedVoter.mobile_number && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-12 w-12"
                          onClick={() => window.open(`tel:${editedVoter.mobile_number}`)}
                        >
                          <Phone className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b">
                      <div className="flex items-center gap-2">
                        <Plane className="h-5 w-5 text-yellow-600" />
                        <Label className="text-base">വിദേശത്ത്</Label>
                      </div>
                      <Switch
                        checked={editedVoter.is_abroad ?? false}
                        onCheckedChange={(checked) => handleEditChange('is_abroad', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between py-3 border-b">
                      <div className="flex items-center gap-2">
                        <Skull className="h-5 w-5 text-gray-600" />
                        <Label className="text-base">മരണപ്പെട്ടു</Label>
                      </div>
                      <Switch
                        checked={editedVoter.is_deceased ?? false}
                        onCheckedChange={(checked) => handleEditChange('is_deceased', checked)}
                      />
                    </div>
                  </div>

                  {/* Add to Group Button */}
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={() => setGroupDialogVoter(selectedVoter)}
                  >
                    <Users className="h-5 w-5 mr-2" />
                    Add to Group
                  </Button>

                  {/* Voted Button */}
                  <Button
                    variant={editedVoter.has_voted ? 'success' : 'outline'}
                    size="xl"
                    className="w-full"
                    onClick={() => handleEditChange('has_voted', !editedVoter.has_voted)}
                  >
                    <CheckCircle className={cn("h-6 w-6 mr-2", editedVoter.has_voted && "fill-current")} />
                    {editedVoter.has_voted ? 'VOTED' : 'Mark as VOTED'}
                  </Button>

                  {/* Save/Discard Buttons */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleDiscardChanges}
                      disabled={!hasChanges || saving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Discard
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSaveChanges}
                      disabled={!hasChanges || saving}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Filter Dialog */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Voted Status</Label>
              <Select
                value={filters.hasVoted || '__all__'}
                onValueChange={(value) => setFilters({ ...filters, hasVoted: (value === '__all__' ? '' : value) as '' | 'yes' | 'no' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  <SelectItem value="yes">Voted</SelectItem>
                  <SelectItem value="no">Not Voted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Political Leaning</Label>
              <Select
                value={filters.politicalLeaning || '__all__'}
                onValueChange={(value) => setFilters({ ...filters, politicalLeaning: (value === '__all__' ? null : value) as PoliticalLeaning })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  <SelectItem value="UDF">UDF</SelectItem>
                  <SelectItem value="LDF">LDF</SelectItem>
                  <SelectItem value="NDA">NDA</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="Neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setFilters({ hasVoted: '', politicalLeaning: '' })
                  setFilterOpen(false)
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <Button className="flex-1" onClick={() => setFilterOpen(false)}>
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vote Confirmation Dialog */}
      <Dialog open={!!voteConfirmVoter} onOpenChange={(open) => !open && setVoteConfirmVoter(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Vote</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center">
              Mark <strong>#{voteConfirmVoter?.serial_no} - {voteConfirmVoter?.name}</strong> as voted?
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setVoteConfirmVoter(null)}>
              Cancel
            </Button>
            <Button onClick={confirmVote} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-2" />
              Confirm Vote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Group Dialog */}
      {portalSession && (
        <AddToGroupDialog
          voter={groupDialogVoter}
          wardId={portalSession.ward_id}
          isOpen={!!groupDialogVoter}
          onClose={() => setGroupDialogVoter(null)}
        />
      )}
    </div>
  )
}
