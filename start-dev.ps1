# start-dev.ps1 - Opens Windows Terminal tabs for lmslocal dev

$repoRoot = "C:\lmslocal"

# Tab 1: Server (npm run dev in lmslocal-server)
Write-Host "Opening Server tab..."
wt -w 0 new-tab -d "$repoRoot\lmslocal-server" cmd /k "npm run dev"

# Wait a moment for first tab to settle
Start-Sleep -Milliseconds 500

# Tab 2: Web (npm run dev in lmslocal-web)
Write-Host "Opening Web tab..."
wt -w 0 new-tab -d "$repoRoot\lmslocal-web" cmd /k "npm run dev"

# Wait a moment
Start-Sleep -Milliseconds 500

# Tab 3: Admin (npm run dev in lmslocal-admin)
Write-Host "Opening Admin tab..."
wt -w 0 new-tab -d "$repoRoot\lmslocal-admin" cmd /k "npm run dev"

# Wait a moment
Start-Sleep -Milliseconds 500

# Tab 4: Root folder - the Claude command is pre-typed at the prompt (see start-claude-tab.ps1),
# waiting on ENTER so it can be edited first. -NoExit keeps the session after the script runs.
Write-Host "Opening root tab..."
wt -w 0 new-tab -d "$repoRoot" powershell -NoExit -ExecutionPolicy Bypass -File "$repoRoot\start-claude-tab.ps1"

Write-Host "Dev environment started. Server, Web, Admin tabs, then root folder tab."
Write-Host "Root tab has the Claude command typed at the prompt - press ENTER to run it."
