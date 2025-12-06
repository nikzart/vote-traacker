import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Users,
  Trash2,
  ChevronRight,
  Loader2,
  X,
  UserPlus,
  UserMinus,
  Phone,
  Plane,
  Skull,
  CheckCircle,
  Check,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  supabase,
  getVoterGroups,
  createVoterGroup,
  getGroupMembers,
  addVoterToGroup,
  removeVoterFromGroup,
  deleteVoterGroup,
  updateVoter,
} from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { cn, getPoliticalLeaningBadgeClasses } from '@/lib/utils'
import type { VoterGroup, Voter, VoterGroupMember } from '@/types'

export default function Groups() {
  const { portalSession } = useAuthStore()
  const { showToast } = useUIStore()
  const isViewOnly = portalSession?.is_view_only ?? false

  const [groups, setGroups] = useState<VoterGroup[]>([])
  const [loading, setLoading] = useState(true)

  // Group search
  const [groupSearchQuery, setGroupSearchQuery] = useState('')

  // Create group dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  // Group details dialog
  const [selectedGroup, setSelectedGroup] = useState<VoterGroup | null>(null)
  const [groupMembers, setGroupMembers] = useState<VoterGroupMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  // Add member dialog
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Voter[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Voter edit dialog
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null)
  const [editedVoter, setEditedVoter] = useState<Partial<Voter>>({})
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load groups
  const loadGroups = async () => {
    if (!portalSession) return
    setLoading(true)
    try {
      const data = await getVoterGroups(portalSession.ward_id)
      setGroups(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [portalSession])

  // Load group members
  const loadGroupMembers = async (groupId: string) => {
    setMembersLoading(true)
    try {
      const data = await getGroupMembers(groupId)
      setGroupMembers(data || [])
    } finally {
      setMembersLoading(false)
    }
  }

  const handleGroupClick = (group: VoterGroup) => {
    setSelectedGroup(group)
    loadGroupMembers(group.id)
    setDetailsDialogOpen(true)
  }

  const handleCreateGroup = async () => {
    if (!portalSession || !newGroupName.trim()) return

    try {
      await createVoterGroup(portalSession.ward_id, newGroupName.trim(), 'family')
      showToast('success', 'Group created')
      setCreateDialogOpen(false)
      setNewGroupName('')
      loadGroups()
    } catch {
      showToast('error', 'Failed to create group')
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this group?')) return

    try {
      await deleteVoterGroup(groupId)
      showToast('success', 'Group deleted')
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null)
        setGroupMembers([])
        setDetailsDialogOpen(false)
      }
      loadGroups()
    } catch {
      showToast('error', 'Failed to delete group')
    }
  }

  // Search voters to add
  const searchVoters = async () => {
    if (!portalSession || !searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      let stationIds: string[]
      if (portalSession.polling_station_id) {
        stationIds = [portalSession.polling_station_id]
      } else {
        const { data: stations } = await supabase
          .from('polling_stations')
          .select('id')
          .eq('ward_id', portalSession.ward_id)
        if (!stations || stations.length === 0) return
        stationIds = stations.map(s => s.id)
      }

      const { data: existingMembers } = await supabase
        .from('voter_group_members')
        .select('voter_id, voter_group:voter_groups!inner(ward_id)')
        .eq('voter_group.ward_id', portalSession.ward_id)

      const existingVoterIds = existingMembers?.map(m => m.voter_id) || []

      const serialNo = parseInt(searchQuery)
      let query = supabase
        .from('voters')
        .select('*, polling_station:polling_stations(code, name)')
        .in('polling_station_id', stationIds)
        .limit(20)

      if (!isNaN(serialNo) && searchQuery.trim() === String(serialNo)) {
        query = query.eq('serial_no', serialNo)
      } else {
        query = query.ilike('name', `%${searchQuery}%`)
      }

      const { data } = await query
      const filteredResults = data?.filter(v => !existingVoterIds.includes(v.id)) || []
      setSearchResults(filteredResults)
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    const debounce = setTimeout(searchVoters, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const handleAddMember = async (voter: Voter) => {
    if (!selectedGroup) return

    if (groupMembers.some(m => m.voter_id === voter.id)) {
      showToast('error', 'Already a member')
      return
    }

    try {
      await addVoterToGroup(selectedGroup.id, voter.id)
      showToast('success', 'Member added')
      loadGroupMembers(selectedGroup.id)
      setSearchQuery('')
      setSearchResults([])
    } catch {
      showToast('error', 'Failed to add member')
    }
  }

  const handleRemoveMember = async (voterId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!selectedGroup) return

    try {
      await removeVoterFromGroup(selectedGroup.id, voterId)
      showToast('success', 'Member removed')
      loadGroupMembers(selectedGroup.id)
    } catch {
      showToast('error', 'Failed to remove member')
    }
  }

  // Voter edit handlers
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
      showToast('success', 'Changes saved')
      setEditDialogOpen(false)
      // Reload group members to reflect changes
      if (selectedGroup) {
        loadGroupMembers(selectedGroup.id)
      }
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

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(groupSearchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Voter Groups</h2>
        {!isViewOnly && (
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Group
          </Button>
        )}
      </div>

      {/* Search Groups */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search groups..."
          value={groupSearchQuery}
          onChange={(e) => setGroupSearchQuery(e.target.value)}
          className="pl-9 h-10"
        />
        {groupSearchQuery && (
          <button
            onClick={() => setGroupSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Groups List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No groups yet</p>
          <p className="text-sm">Create a group to organize voters</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              onClick={() => handleGroupClick(group)}
              className="flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-sm">{group.name}</p>
              </div>
              <div className="flex items-center gap-1">
                {!isViewOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteGroup(group.id)
                    }}
                    className="p-1 hover:bg-red-100 rounded text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
          {filteredGroups.length === 0 && groupSearchQuery && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No groups match "{groupSearchQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* Group Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col [&>button]:hidden">
          <div className="flex items-center justify-between flex-shrink-0 pb-2">
            <DialogTitle>{selectedGroup?.name} ({groupMembers.length})</DialogTitle>
            <div className="flex items-center gap-2">
              {selectedGroup && !isViewOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddMemberDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
              <button
                onClick={() => setDetailsDialogOpen(false)}
                className="p-2 rounded-lg border opacity-70 hover:opacity-100 hover:bg-muted transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : groupMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No members yet</p>
                <p className="text-sm">Add voters to this group</p>
              </div>
            ) : (
              groupMembers.map((member) => {
                const voter = member.voter
                if (!voter) return null
                return (
                  <Card
                    key={member.id}
                    onClick={() => handleVoterClick(voter)}
                    className={cn(
                      "transition-all",
                      !isViewOnly && "cursor-pointer active:scale-[0.98]",
                      voter.has_voted && "bg-green-50 border-green-200",
                      voter.is_deceased && "opacity-50"
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base font-bold text-primary">
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
                          <p className="font-medium text-sm truncate">{voter.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {voter.guardian_name} • {voter.house_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
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
                        <div className="flex gap-1.5 flex-shrink-0">
                          {voter.mobile_number && (
                            <button
                              type="button"
                              className="h-10 w-10 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 flex items-center justify-center transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(`tel:${voter.mobile_number}`)
                              }}
                            >
                              <Phone className="h-4 w-4 stroke-green-600" strokeWidth={2} />
                            </button>
                          )}
                          {!isViewOnly && !voter.has_voted && (
                            <button
                              type="button"
                              className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 flex items-center justify-center transition-colors"
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await updateVoter(voter.id, { has_voted: true })
                                  showToast('success', 'Marked as voted')
                                  if (selectedGroup) loadGroupMembers(selectedGroup.id)
                                } catch {
                                  showToast('error', 'Failed to update')
                                }
                              }}
                            >
                              <CheckCircle className="h-4 w-4 stroke-blue-600" strokeWidth={2} />
                            </button>
                          )}
                          {!isViewOnly && (
                            <button
                              type="button"
                              className="h-10 w-10 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 flex items-center justify-center transition-colors"
                              onClick={(e) => handleRemoveMember(voter.id, e)}
                            >
                              <UserMinus className="h-4 w-4 stroke-red-600" strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                placeholder="e.g., Kumar Family"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to {selectedGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by serial number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {searchLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((voter: any) => {
                  const isAlreadyMember = groupMembers.some(m => m.voter_id === voter.id)
                  const stationCode = voter.polling_station?.code || ''
                  return (
                    <div
                      key={voter.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        isAlreadyMember && "opacity-50"
                      )}
                    >
                      <div>
                        <p className="font-medium">
                          #{voter.serial_no} - {voter.name}
                          {stationCode && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {stationCode}
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {voter.house_name}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={isAlreadyMember ? 'secondary' : 'default'}
                        disabled={isAlreadyMember}
                        onClick={() => handleAddMember(voter)}
                      >
                        {isAlreadyMember ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : searchQuery ? (
              <p className="text-center text-muted-foreground py-4">
                No voters found
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Voter Edit Dialog */}
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
    </div>
  )
}
