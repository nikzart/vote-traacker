import { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  Users,
  Check,
  Loader2,
  X,
  Home,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getVoterGroups,
  createVoterGroup,
  addVoterToGroup,
  removeVoterFromGroup,
  getVoterGroupMembership,
} from '@/lib/supabase'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import type { Voter, VoterGroup } from '@/types'

interface AddToGroupDialogProps {
  voter: Voter | null
  wardId: string
  isOpen: boolean
  onClose: () => void
}

interface GroupMembership {
  group_id: string
  voter_group: VoterGroup
}

export default function AddToGroupDialog({
  voter,
  wardId,
  isOpen,
  onClose,
}: AddToGroupDialogProps) {
  const { showToast } = useUIStore()
  const [groups, setGroups] = useState<VoterGroup[]>([])
  const [membership, setMembership] = useState<GroupMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Load groups and membership
  useEffect(() => {
    if (!isOpen || !voter) return

    const loadData = async () => {
      setLoading(true)
      try {
        const [groupsData, membershipData] = await Promise.all([
          getVoterGroups(wardId),
          getVoterGroupMembership(voter.id, wardId),
        ])
        setGroups(groupsData || [])
        setMembership((membershipData || []) as GroupMembership[])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isOpen, voter, wardId])

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isInGroup = (groupId: string) =>
    membership.some((m) => m.group_id === groupId)

  const handleCreateGroup = async (name: string) => {
    if (!voter) return
    setCreating(true)
    try {
      const newGroup = await createVoterGroup(wardId, name, 'family')
      if (newGroup) {
        await addVoterToGroup(newGroup.id, voter.id)
        setGroups((prev) => [...prev, newGroup])
        setMembership((prev) => [...prev, { group_id: newGroup.id, voter_group: newGroup }])
        showToast('success', `Created "${name}" and added voter`)
      }
    } catch {
      showToast('error', 'Failed to create group')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleGroup = async (group: VoterGroup) => {
    if (!voter) return
    setActionLoading(group.id)
    try {
      if (isInGroup(group.id)) {
        await removeVoterFromGroup(group.id, voter.id)
        setMembership((prev) => prev.filter((m) => m.group_id !== group.id))
        showToast('success', `Removed from "${group.name}"`)
      } else {
        await addVoterToGroup(group.id, voter.id)
        setMembership((prev) => [...prev, { group_id: group.id, voter_group: group }])
        showToast('success', `Added to "${group.name}"`)
      }
    } catch {
      showToast('error', 'Failed to update group')
    } finally {
      setActionLoading(null)
    }
  }

  const currentGroups = membership.map((m) => m.voter_group)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add to Group
          </DialogTitle>
        </DialogHeader>

        {voter && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Voter Info */}
            <div className="bg-muted p-3 rounded-lg mb-4">
              <p className="font-medium">#{voter.serial_no} - {voter.name}</p>
              <p className="text-sm text-muted-foreground">{voter.house_name}</p>
            </div>

            {/* Current Groups */}
            {currentGroups.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Current Groups:</p>
                <div className="flex flex-wrap gap-2">
                  {currentGroups.map((g) => (
                    <Badge key={g.id} variant="secondary" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {g.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Create with House Name */}
            {voter.house_name && !groups.some((g) => g.name === voter.house_name) && (
              <Button
                variant="outline"
                className="mb-4 justify-start"
                onClick={() => handleCreateGroup(voter.house_name!)}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Home className="h-4 w-4 mr-2" />
                )}
                Create "{voter.house_name}" group
              </Button>
            )}

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Groups List */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No groups found</p>
                  {searchQuery && (
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => handleCreateGroup(searchQuery)}
                      disabled={creating}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create "{searchQuery}"
                    </Button>
                  )}
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const inGroup = isInGroup(group.id)
                  const isLoading = actionLoading === group.id
                  return (
                    <button
                      key={group.id}
                      onClick={() => handleToggleGroup(group)}
                      disabled={isLoading}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left",
                        inGroup
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{group.name}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {group.group_type}
                          </Badge>
                        </div>
                      </div>
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : inGroup ? (
                        <Check className="h-5 w-5 text-primary" />
                      ) : (
                        <Plus className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
