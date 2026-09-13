# Run the Jvalyx backend (FastAPI :8000) and frontend (Vite :5173) together.
# Ctrl+C stops the frontend and then the backend.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$backend = Start-Process -PassThru -NoNewWindow -WorkingDirectory $root `
    .\.venv\Scripts\python.exe -ArgumentList "app.py"

try {
    Push-Location (Join-Path $root "frontend")
    npm run dev
}
finally {
    Pop-Location
    if ($backend -and -not $backend.HasExited) {
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
}
