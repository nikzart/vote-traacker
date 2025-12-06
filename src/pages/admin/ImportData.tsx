import { useState, useCallback } from 'react'
import { Upload, FileJson, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import type { ImportedData } from '@/types'

interface ImportFile {
  file: File
  data: ImportedData | null
  status: 'pending' | 'importing' | 'success' | 'error'
  error?: string
  voterCount?: number
}

export default function ImportData() {
  const [files, setFiles] = useState<ImportFile[]>([])
  const [importing, setImporting] = useState(false)
  const { showToast } = useUIStore()

  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const newFiles: ImportFile[] = []

    for (const file of Array.from(selectedFiles)) {
      if (!file.name.endsWith('.json')) {
        showToast('error', `${file.name} is not a JSON file`)
        continue
      }

      try {
        const text = await file.text()
        const data = JSON.parse(text) as ImportedData

        // Validate structure
        if (!data.District || !data['Local Body'] || !data.Ward || !data.voters) {
          showToast('error', `${file.name} has invalid structure`)
          continue
        }

        newFiles.push({
          file,
          data,
          status: 'pending',
          voterCount: data.voters.length,
        })
      } catch {
        showToast('error', `Failed to parse ${file.name}`)
      }
    }

    setFiles((prev) => [...prev, ...newFiles])
  }, [showToast])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect]
  )

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const importFile = async (importFile: ImportFile, index: number) => {
    if (!importFile.data) return

    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: 'importing' } : f))
    )

    try {
      const data = importFile.data

      // 1. Upsert District
      const { data: district, error: districtError } = await supabase
        .from('districts')
        .upsert({ name: data.District }, { onConflict: 'name' })
        .select()
        .single()

      if (districtError) throw districtError

      // 2. Upsert Local Body
      const { data: localBody, error: lbError } = await supabase
        .from('local_bodies')
        .upsert(
          {
            district_id: district.id,
            name: data['Local Body'],
            code: data['Local Body Code'],
          },
          { onConflict: 'district_id,code' }
        )
        .select()
        .single()

      if (lbError) throw lbError

      // 3. Upsert Ward
      const { data: ward, error: wardError } = await supabase
        .from('wards')
        .upsert(
          {
            local_body_id: localBody.id,
            name: data.Ward,
            ward_number: data['Ward Number'],
          },
          { onConflict: 'local_body_id,ward_number' }
        )
        .select()
        .single()

      if (wardError) throw wardError

      // 4. Upsert Polling Station
      const { data: pollingStation, error: psError } = await supabase
        .from('polling_stations')
        .upsert(
          {
            ward_id: ward.id,
            name: data['Polling Station'],
            code: data['Polling Station Code'],
          },
          { onConflict: 'ward_id,code' }
        )
        .select()
        .single()

      if (psError) throw psError

      // 5. Upsert Voters in batches
      const batchSize = 100
      const voters = data.voters.map((v) => ({
        polling_station_id: pollingStation.id,
        serial_no: parseInt(v['Serial No.']),
        name: v.Name,
        guardian_name: v["Guardian's Name"],
        house_no: v['OldWard No/ House No.'],
        house_name: v['House Name'],
        gender: v.Gender as 'M' | 'F',
        age: parseInt(v.Age) || null,
        sec_id: v['New SEC ID No.'],
      }))

      for (let i = 0; i < voters.length; i += batchSize) {
        const batch = voters.slice(i, i + batchSize)
        const { error: voterError } = await supabase
          .from('voters')
          .upsert(batch, { onConflict: 'polling_station_id,serial_no' })

        if (voterError) throw voterError
      }

      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: 'success' } : f))
      )
    } catch (error: unknown) {
      const err = error as { message?: string }
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: 'error', error: err.message || 'Import failed' } : f
        )
      )
    }
  }

  const importAll = async () => {
    setImporting(true)
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'pending') {
        await importFile(files[i], i)
      }
    }
    setImporting(false)
    showToast('success', 'Import completed')
  }

  const pendingFiles = files.filter((f) => f.status === 'pending')
  const successFiles = files.filter((f) => f.status === 'success')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground">
          Import polling station data from JSON files
        </p>
      </div>

      {/* Drop Zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              "hover:border-primary hover:bg-primary/5 cursor-pointer"
            )}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".json"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Drop JSON files here</p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Files to Import</CardTitle>
              <CardDescription>
                {pendingFiles.length} pending, {successFiles.length} completed
              </CardDescription>
            </div>
            {pendingFiles.length > 0 && (
              <Button onClick={importAll} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import All ({pendingFiles.length})
                  </>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border",
                    file.status === 'success' && "bg-green-50 border-green-200",
                    file.status === 'error' && "bg-red-50 border-red-200"
                  )}
                >
                  <FileJson className="h-8 w-8 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.file.name}</p>
                    {file.data && (
                      <p className="text-sm text-muted-foreground">
                        {file.data.District} &gt; {file.data['Local Body']} &gt;{' '}
                        {file.data.Ward} &gt; {file.data['Polling Station']}
                      </p>
                    )}
                    {file.error && (
                      <p className="text-sm text-red-600">{file.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {file.voterCount && (
                      <Badge variant="secondary">{file.voterCount} voters</Badge>
                    )}
                    {file.status === 'pending' && (
                      <Badge variant="outline">Pending</Badge>
                    )}
                    {file.status === 'importing' && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    {file.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    {file.status === 'pending' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">JSON File Format</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto">
{`{
  "District": "IDUKKI",
  "Local Body": "Konnathady",
  "Local Body Code": "G06002",
  "Ward": "MUNIYARA NORTH",
  "Ward Number": "G06002004",
  "Polling Station": "Govt UPS Muniyara",
  "Polling Station Code": "001",
  "voters": [
    {
      "Serial No.": "1",
      "Name": "Voter Name",
      "Guardian's Name": "Guardian Name",
      "OldWard No/ House No.": "001/461",
      "House Name": "House Name",
      "Gender": "M",
      "Age": "28",
      "New SEC ID No.": "SEC049141406"
    }
  ]
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
