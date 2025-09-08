'use client'

interface AutoSwitchProps {
  autoMode: boolean
  onAutoModeChange: (enabled: boolean) => void
}

export function AutoSwitch({ autoMode, onAutoModeChange }: AutoSwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={autoMode}
          onChange={(e) => onAutoModeChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-11 h-6 rounded-full transition-colors ${
          autoMode ? 'bg-green-500' : 'bg-muted'
        }`}>
          <div className={`w-4 h-4 bg-card rounded-full shadow transform transition-transform ${
            autoMode ? 'translate-x-6' : 'translate-x-1'
          } mt-1`} />
        </div>
      </label>
      <span className="text-xs text-muted-foreground">Auto</span>
    </div>
  )
}
