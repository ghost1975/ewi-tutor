# Репетитор EWI: випуск нової версії
# Запуск: release.cmd (виправлення), release.cmd minor (нові функції)
param([ValidateSet('patch','minor','major')][string]$Part = 'patch')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Set-Location $PSScriptRoot
$NoBom = New-Object System.Text.UTF8Encoding $false
function Invoke-Git { & (Get-Command git -CommandType Application | Select-Object -First 1) @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed" } }
try {
  if (-not (Test-Path .git)) { throw 'Run setup-github.cmd first.' }
  $pkgPath = (Join-Path $PSScriptRoot 'package.json'); $lockPath = (Join-Path $PSScriptRoot 'package-lock.json')
  $pkg = [IO.File]::ReadAllText($pkgPath); $old = ($pkg | ConvertFrom-Json).version
  if ($pkg -match 'YOUR_GITHUB_NAME') { $me = (gh api user --jq .login).Trim(); $pkg = $pkg -replace 'YOUR_GITHUB_NAME', $me }
  $v = $old.Split('.') | ForEach-Object { [int]$_ }
  switch ($Part) { 'major' { $v = @(($v[0]+1), 0, 0) } 'minor' { $v = @($v[0], ($v[1]+1), 0) } default { $v = @($v[0], $v[1], ($v[2]+1)) } }
  $new = $v -join '.'
  $pkg = $pkg -replace ('"version": "' + [regex]::Escape($old) + '"'), ('"version": "' + $new + '"')
  [IO.File]::WriteAllText($pkgPath, $pkg, $NoBom)
  if (Test-Path $lockPath) { $lock = [IO.File]::ReadAllText($lockPath); $lock = [regex]::Replace($lock, '("name": "ewi-tutor",\s*"version": ")[^"]+', '${1}' + $new); [IO.File]::WriteAllText($lockPath, $lock, $NoBom) }
  if (Get-Command python -ErrorAction SilentlyContinue) { python build-web.py | Out-Host }
  Invoke-Git add -A
  Invoke-Git commit -m "Version $new" | Out-Null
  Invoke-Git tag "v$new"
  Invoke-Git push origin main
  Invoke-Git push origin "v$new"
  Write-Host "Version $old -> $new pushed. GitHub builds the installer in 5-10 minutes, then installed apps update themselves." -ForegroundColor Green
  $repo = "$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>$null)".Trim()
  if (-not $repo) { $repo = ((git remote get-url origin) -replace '^.*github\.com[:/]', '' -replace '\.git$', '') }
  Write-Host "Build progress: https://github.com/$repo/actions"
  $run = $null
  for ($i = 0; $i -lt 30 -and -not $run; $i++) { Start-Sleep 5; $runs = gh run list --workflow release.yml --limit 5 --json databaseId,headBranch | ConvertFrom-Json; $run = ($runs | Where-Object { $_.headBranch -eq "v$new" } | Select-Object -First 1).databaseId }
  if ($run) { gh run watch $run --exit-status; if ($LASTEXITCODE -eq 0) { Write-Host "Release v$new is published: https://github.com/$repo/releases" -ForegroundColor Green } else { Write-Host "Build failed: https://github.com/$repo/actions" -ForegroundColor Red } }
} catch { Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red }
