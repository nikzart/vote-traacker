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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import {
  supabase,
  getVoterGroups,
  createVoterGroup,
  getGroupMembers,
  addVoterToGroup,
  removeVoterFromGroup,
  deleteVoterGroup,
} from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import type { VoterGroup, Voter, VoterGroupMember } from '@/types'

export default function Groups() {
  const { portalSession } = useAuthStore()
  const { showToast } = useUIStore()

  const [groups, setGroups] = useState<VoterGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<VoterGroup | null>(null)
  const [groupMembers, setGroupMembers] = useState<VoterGroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)

  // Create group dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupType, setNewGroupType] = useState<'family' | 'custom'>('family')

  // Add member dialog
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Voter[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

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
  }

  const handleCreateGroup = async () => {
    if (!portalSession || !newGroupName.trim()) return

    try {
      await createVoterGroup(portalSession.ward_id, newGroupName.trim(), newGroupType)
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
      // Get polling station IDs based on credential access scope
      let stationIds: string[]
      if (portalSession.polling_station_id) {
        // Non-master: only their assigned polling station
        stationIds = [portalSession.polling_station_id]
      } else {
        // Master: all polling stations in ward
        const { data: stations } = await supabase
          .from('polling_stations')
          .select('id')
          .eq('ward_id', portalSession.ward_id)
        if (!stations || stations.length === 0) return
        stationIds = stations.map(s => s.id)
      }

      // Get all voters already in any group in this ward
      const { data: existingMembers } = await supabase
        .from('voter_group_members')
        .select('voter_id, voter_group:voter_groups!inner(ward_id)')
        .eq('voter_group.ward_id', portalSession.ward_id)

      const existingVoterIds = existingMembers?.map(m => m.voter_id) || []

      // Search voters with polling station info
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

      // Filter out voters already in any group
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

    // Check if already a member
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

  const handleRemoveMember = async (voterId: string) => {
    if (!selectedGroup) return

    try {
      await removeVoterFromGroup(selectedGroup.id, voterId)
      showToast('success', 'Member removed')
      loadGroupMembers(selectedGroup.id)
    } catch {
      showToast('error', 'Failed to remove member')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Voter Groups</h2>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Group
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Groups List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Groups</CardTitle>
          </CardHeader>
          <CardContent>
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
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleGroupClick(group)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedGroup?.id === group.id
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {group.group_type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteGroup(group.id)
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Group Members */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {selectedGroup ? selectedGroup.name : 'Select a group'}
            </CardTitle>
            {selectedGroup && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddMemberDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedGroup ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Select a group to view members</p>
              </div>
            ) : membersLoading ? (
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
              <div className="space-y-2">
                {groupMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">
                        #{member.voter?.serial_no} - {member.voter?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.voter?.house_name}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.voter_id)}
                      className="p-2 hover:bg-red-100 rounded text-red-500"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
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
              />
            </div>
            <div className="space-y-2">
              <Label>Group Type</Label>
              <Select value={newGroupType} onValueChange={(v) => setNewGroupType(v as 'family' | 'custom')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup}>Create</Button>
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
    </div>
  )
}
