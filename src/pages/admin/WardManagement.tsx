import { useState, useEffect } from 'react'
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  Building2,
  Home,
  Vote,
  Plus,
  Trash2,
  Edit,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { supabase, getDistricts, getLocalBodies, getWards, getPollingStations } from '@/lib/supabase'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import type { District, LocalBody, Ward, PollingStation } from '@/types'

type NodeType = 'district' | 'local_body' | 'ward' | 'polling_station'

interface TreeItemProps {
  type: NodeType
  data: District | LocalBody | Ward | PollingStation
  level: number
  onDelete: () => void
  onEdit: () => void
}

function TreeItem({ type, data, level, onDelete, onEdit }: TreeItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<(LocalBody | Ward | PollingStation)[]>([])
  const [loading, setLoading] = useState(false)

  const icons = {
    district: MapPin,
    local_body: Building2,
    ward: Home,
    polling_station: Vote,
  }

  const Icon = icons[type]

  const loadChildren = async () => {
    if (type === 'polling_station') return
    setLoading(true)
    try {
      if (type === 'district') {
        const data2 = await getLocalBodies((data as District).id)
        setChildren(data2 || [])
      } else if (type === 'local_body') {
        const data2 = await getWards((data as LocalBody).id)
        setChildren(data2 || [])
      } else if (type === 'ward') {
        const data2 = await getPollingStations((data as Ward).id)
        setChildren(data2 || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    if (!expanded && children.length === 0) {
      loadChildren()
    }
    setExpanded(!expanded)
  }

  const childType: NodeType | null =
    type === 'district' ? 'local_body' :
    type === 'local_body' ? 'ward' :
    type === 'ward' ? 'polling_station' : null

  const displayName = type === 'local_body'
    ? `${(data as LocalBody).name} (${(data as LocalBody).code})`
    : type === 'ward'
    ? `${(data as Ward).name} (${(data as Ward).ward_number})`
    : type === 'polling_station'
    ? `${(data as PollingStation).code} - ${(data as PollingStation).name}`
    : (data as District).name

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 hover:bg-gray-100 rounded-md cursor-pointer group",
          "transition-colors"
        )}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
      >
        {type !== 'polling_station' && (
          <button onClick={handleToggle} className="p-1 hover:bg-gray-200 rounded">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
        {type === 'polling_station' && <div className="w-6" />}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm truncate" onClick={handleToggle}>
          {displayName}
        </span>
        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
          <button onClick={onEdit} className="p-1 hover:bg-gray-200 rounded">
            <Edit className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-red-100 rounded">
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      </div>
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeItem
              key={child.id}
              type={childType!}
              data={child}
              level={level + 1}
              onDelete={() => handleDeleteItem(childType!, child.id)}
              onEdit={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function handleDeleteItem(type: NodeType, id: string) {
  const table = type === 'district' ? 'districts' :
    type === 'local_body' ? 'local_bodies' :
    type === 'ward' ? 'wards' : 'polling_stations'

  if (!confirm(`Delete this ${type.replace('_', ' ')}? This will also delete all nested items.`)) {
    return
  }

  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) {
    alert('Error deleting: ' + error.message)
  } else {
    window.location.reload()
  }
}

export default function WardManagement() {
  const [districts, setDistricts] = useState<District[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createType, setCreateType] = useState<NodeType>('district')
  const [parentId, setParentId] = useState<string>('')
  const [formData, setFormData] = useState({ name: '', code: '' })
  const { showToast } = useUIStore()

  const loadDistricts = async () => {
    setLoading(true)
    try {
      const data = await getDistricts()
      setDistricts(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDistricts()
  }, [])

  const handleCreate = async () => {
    if (!formData.name) {
      showToast('error', 'Name is required')
      return
    }

    try {
      if (createType === 'district') {
        const { error } = await supabase.from('districts').insert({ name: formData.name })
        if (error) throw error
      } else if (createType === 'local_body') {
        const { error } = await supabase.from('local_bodies').insert({
          district_id: parentId,
          name: formData.name,
          code: formData.code,
        })
        if (error) throw error
      } else if (createType === 'ward') {
        const { error } = await supabase.from('wards').insert({
          local_body_id: parentId,
          name: formData.name,
          ward_number: formData.code,
        })
        if (error) throw error
      } else if (createType === 'polling_station') {
        const { error } = await supabase.from('polling_stations').insert({
          ward_id: parentId,
          name: formData.name,
          code: formData.code,
        })
        if (error) throw error
      }

      showToast('success', `${createType.replace('_', ' ')} created successfully`)
      setDialogOpen(false)
      setFormData({ name: '', code: '' })
      loadDistricts()
    } catch (error: unknown) {
      const err = error as { message?: string }
      showToast('error', err.message || 'Failed to create')
    }
  }

  const openCreateDialog = (type: NodeType, parent?: string) => {
    setCreateType(type)
    setParentId(parent || '')
    setFormData({ name: '', code: '' })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ward Management</h1>
          <p className="text-muted-foreground">
            Manage districts, local bodies, wards, and polling stations
          </p>
        </div>
        <Button onClick={() => openCreateDialog('district')}>
          <Plus className="h-4 w-4 mr-2" />
          Add District
        </Button>
      </div>

      {/* Tree View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : districts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No districts found</p>
              <p className="text-sm">Import data or create a district to get started</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              {districts.map((district) => (
                <TreeItem
                  key={district.id}
                  type="district"
                  data={district}
                  level={0}
                  onDelete={() => handleDeleteItem('district', district.id)}
                  onEdit={() => {}}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create {createType.replace('_', ' ')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`Enter ${createType.replace('_', ' ')} name`}
              />
            </div>
            {createType !== 'district' && (
              <div className="space-y-2">
                <Label htmlFor="code">
                  {createType === 'ward' ? 'Ward Number' : 'Code'}
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder={`Enter ${createType === 'ward' ? 'ward number' : 'code'}`}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
