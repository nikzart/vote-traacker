import { useState, useEffect } from 'react'
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Loader2,
  Shield,
  Building2,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase, getDistricts, getLocalBodies, getWards, getPollingStations, getWardCredentials } from '@/lib/supabase'
import { useUIStore } from '@/stores/uiStore'
import { generateRandomPassword } from '@/lib/utils'
import type { District, LocalBody, Ward, PollingStation, WardCredential } from '@/types'

export default function Credentials() {
  const [credentials, setCredentials] = useState<WardCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const { showToast } = useUIStore()

  // Form state
  const [districts, setDistricts] = useState<District[]>([])
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  const [pollingStations, setPollingStations] = useState<PollingStation[]>([])
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedLocalBody, setSelectedLocalBody] = useState('')
  const [selectedWard, setSelectedWard] = useState('')
  const [selectedPollingStation, setSelectedPollingStation] = useState('')
  const [isMaster, setIsMaster] = useState(false)
  const [isViewOnly, setIsViewOnly] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const loadCredentials = async () => {
    setLoading(true)
    try {
      const data = await getWardCredentials()
      setCredentials(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCredentials()
    getDistricts().then(setDistricts)
  }, [])

  useEffect(() => {
    if (selectedDistrict) {
      getLocalBodies(selectedDistrict).then(setLocalBodies)
      setSelectedLocalBody('')
      setSelectedWard('')
      setSelectedPollingStation('')
    }
  }, [selectedDistrict])

  useEffect(() => {
    if (selectedLocalBody) {
      getWards(selectedLocalBody).then(setWards)
      setSelectedWard('')
      setSelectedPollingStation('')
    }
  }, [selectedLocalBody])

  useEffect(() => {
    if (selectedWard) {
      getPollingStations(selectedWard).then(setPollingStations)
      setSelectedPollingStation('')
    }
  }, [selectedWard])

  const openCreateDialog = () => {
    setSelectedDistrict('')
    setSelectedLocalBody('')
    setSelectedWard('')
    setSelectedPollingStation('')
    setIsMaster(false)
    setIsViewOnly(false)
    setUsername('')
    setPassword(generateRandomPassword())
    setDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!selectedWard || !username || !password) {
      showToast('error', 'Please fill all required fields')
      return
    }

    try {
      const { error } = await supabase.from('ward_credentials').insert({
        ward_id: selectedWard,
        polling_station_id: isMaster ? null : selectedPollingStation || null,
        username,
        password_hash: password, // In production, hash this
        is_master: isMaster,
        is_view_only: isViewOnly,
        is_active: true,
      })

      if (error) throw error

      showToast('success', 'Credential created successfully')
      setDialogOpen(false)
      loadCredentials()
    } catch (error: unknown) {
      const err = error as { message?: string }
      showToast('error', err.message || 'Failed to create credential')
    }
  }

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('ward_credentials')
      .update({ is_active: !currentActive })
      .eq('id', id)

    if (error) {
      showToast('error', 'Failed to update status')
    } else {
      loadCredentials()
    }
  }

  const toggleViewOnly = async (id: string, currentViewOnly: boolean) => {
    const { error } = await supabase
      .from('ward_credentials')
      .update({ is_view_only: !currentViewOnly })
      .eq('id', id)

    if (error) {
      showToast('error', 'Failed to update view-only status')
    } else {
      loadCredentials()
    }
  }

  const resetPassword = async (id: string) => {
    const newPassword = generateRandomPassword()
    const { error } = await supabase
      .from('ward_credentials')
      .update({ password_hash: newPassword })
      .eq('id', id)

    if (error) {
      showToast('error', 'Failed to reset password')
    } else {
      showToast('success', `New password: ${newPassword}`)
      loadCredentials()
    }
  }

  const deleteCredential = async (id: string) => {
    if (!confirm('Delete this credential?')) return

    const { error } = await supabase
      .from('ward_credentials')
      .delete()
      .eq('id', id)

    if (error) {
      showToast('error', 'Failed to delete')
    } else {
      showToast('success', 'Credential deleted')
      loadCredentials()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('success', 'Copied to clipboard')
  }

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Group credentials by ward
  const groupedCredentials = credentials.reduce((acc, cred) => {
    const wardId = cred.ward_id
    if (!acc[wardId]) {
      acc[wardId] = {
        ward: cred.ward,
        credentials: [],
      }
    }
    acc[wardId].credentials.push(cred)
    return acc
  }, {} as Record<string, { ward: Ward | undefined; credentials: WardCredential[] }>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Credentials</h1>
          <p className="text-muted-foreground">
            Manage Ward Access Portal credentials
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Credential
        </Button>
      </div>

      {/* Credentials List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : Object.keys(groupedCredentials).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No credentials found</p>
            <p className="text-sm text-muted-foreground">
              Create credentials for ward operatives
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCredentials).map(([wardId, { ward, credentials: creds }]) => (
            <Card key={wardId}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {ward?.name || 'Unknown Ward'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {creds.map((cred) => (
                    <div
                      key={cred.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {cred.is_master ? (
                          <Shield className="h-5 w-5 text-amber-500" />
                        ) : (
                          <Key className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{cred.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {cred.is_master
                              ? 'Master (Full ward access)'
                              : cred.polling_station?.name || 'No polling station'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-muted rounded px-2 py-1">
                          <span className="text-sm font-mono">
                            {showPasswords[cred.id]
                              ? cred.password_hash
                              : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(cred.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            {showPasswords[cred.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(cred.password_hash)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {cred.is_view_only && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                            <Eye className="h-3 w-3 mr-1" />
                            View Only
                          </Badge>
                        )}
                        <Badge variant={cred.is_active ? 'default' : 'secondary'}>
                          {cred.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Switch
                          checked={cred.is_active}
                          onCheckedChange={() => toggleActive(cred.id, cred.is_active)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleViewOnly(cred.id, cred.is_view_only)}
                          title={cred.is_view_only ? 'Remove view-only' : 'Make view-only'}
                          className={cred.is_view_only ? 'text-yellow-600' : ''}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resetPassword(cred.id)}
                          title="Reset password"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCredential(cred.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Credential</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>District</Label>
              <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Local Body</Label>
              <Select
                value={selectedLocalBody}
                onValueChange={setSelectedLocalBody}
                disabled={!selectedDistrict}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select local body" />
                </SelectTrigger>
                <SelectContent>
                  {localBodies.map((lb) => (
                    <SelectItem key={lb.id} value={lb.id}>
                      {lb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ward</Label>
              <Select
                value={selectedWard}
                onValueChange={setSelectedWard}
                disabled={!selectedLocalBody}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  {wards.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isMaster} onCheckedChange={setIsMaster} />
              <Label>Master credential (full ward access)</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isViewOnly} onCheckedChange={setIsViewOnly} />
              <Label>View only (read-only access)</Label>
            </div>

            {!isMaster && (
              <div className="space-y-2">
                <Label>Polling Station</Label>
                <Select
                  value={selectedPollingStation}
                  onValueChange={setSelectedPollingStation}
                  disabled={!selectedWard}
                >
                  <SelectTrigger>
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
              </div>
            )}

            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
                <Button
                  variant="outline"
                  onClick={() => setPassword(generateRandomPassword())}
                >
                  Generate
                </Button>
              </div>
            </div>
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
