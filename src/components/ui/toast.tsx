import { CheckCircle, XCircle, Info, X } from "lucide-react"
import { useUIStore } from "@/stores/uiStore"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toastMessage, clearToast } = useUIStore()

  if (!toastMessage) return null

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  }

  const bgColors = {
    success: "bg-green-50 border-green-200",
    error: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border p-4 shadow-lg",
          bgColors[toastMessage.type]
        )}
      >
        {icons[toastMessage.type]}
        <p className="text-sm font-medium">{toastMessage.message}</p>
        <button
          onClick={clearToast}
          className="ml-2 rounded-full p-1 hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
