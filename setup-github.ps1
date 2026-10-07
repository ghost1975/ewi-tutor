# Репетитор EWI: одноразове налаштування GitHub для автооновлень
# Запуск: подвійний клік по setup-github.cmd
# 'Continue': у Windows PowerShell 5.1 повідомлення git/gh у stderr інакше вважаються помилками
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Set-Location $PSScriptRoot
$Repo = 'ewi-tutor'
$NoBom = New-Object System.Text.UTF8Encoding $false

function Step($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Yellow }
function RefreshPath { $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') }
function Need($cmd, $id, $name) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { return }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "$name and winget not found. Install $name manually and run this script again." }
  Write-Host "Installing $name with winget..."
  winget install --id $id -e --source winget --accept-source-agreements --accept-package-agreements | Out-Host
  RefreshPath
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$name was installed but '$cmd' is not visible yet. Close this window and run the script again." }
}
function Invoke-Git { & (Get-Command git -CommandType Application | Select-Object -First 1) @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed" } }

try {
  Step 'Checking Git and GitHub CLI'
  Need git 'Git.Git' 'Git'
  Need gh 'GitHub.cli' 'GitHub CLI'

  Step 'Signing in to GitHub'
  gh auth status *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'A browser will open. Copy the one-time code shown here and confirm the sign-in to your GitHub account.'
    gh auth login --hostname github.com --git-protocol https --web --scopes 'repo,workflow'
    if ($LASTEXITCODE -ne 0) { throw 'GitHub sign-in was not completed.' }
  }
  gh auth setup-git | Out-Null
  $Owner = (gh api user --jq .login).Trim()
  Write-Host "Account: $Owner"

  Step 'Configuring package.json'
  $pkgText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'package.json'))
  if ($pkgText -match 'YOUR_GITHUB_NAME') { $pkgText = $pkgText -replace 'YOUR_GITHUB_NAME', $Owner; [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'package.json'), $pkgText, $NoBom) }
  $Version = ($pkgText | ConvertFrom-Json).version
  Write-Host "Version: $Version"

  Step 'Preparing local repository'
  if (-not (Test-Path .git)) { Invoke-Git init -b main | Out-Null }
  if (-not (git config user.name)) { $n = (gh api user --jq '.name // .login').Trim(); Invoke-Git config user.name "$n" }
  if (-not (git config user.email)) { $uid = (gh api user --jq .id).Trim(); Invoke-Git config user.email "$uid+$Owner@users.noreply.github.com" }
  Invoke-Git add -A
  git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { Invoke-Git commit -m "EWI Tutor $Version" | Out-Null }

  Step "Creating public repository $Owner/$Repo"
  gh repo view "$Owner/$Repo" *> $null
  if ($LASTEXITCODE -ne 0) {
    gh repo create $Repo --public --description 'EWI Tutor: learning app for Akai EWI Solo' --source . --remote origin --push
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the repository.' }
  } else {
    Write-Host 'Repository already exists, updating it.'
    if (-not (git remote)) { Invoke-Git remote add origin "https://github.com/$Owner/$Repo.git" }
    Invoke-Git push -u origin main
  }

  Step "Starting installer build v$Version"
  git rev-parse "v$Version" *> $null; if ($LASTEXITCODE -ne 0) { Invoke-Git tag "v$Version" }
  Invoke-Git push origin "v$Version"
  Write-Host 'GitHub is building the installer, this takes 5-10 minutes.'
  $run = $null
  for ($i = 0; $i -lt 30 -and -not $run; $i++) { Start-Sleep 5; $runs = gh run list --workflow release.yml --limit 5 --json databaseId,headBranch | ConvertFrom-Json; $run = ($runs | Where-Object { $_.headBranch -eq "v$Version" } | Select-Object -First 1).databaseId }
  if ($run) { gh run watch $run --exit-status; if ($LASTEXITCODE -ne 0) { throw "Build failed. Details: https://github.com/$Owner/$Repo/actions" } }
  else { Write-Host "Build did not start in time. Check manually: https://github.com/$Owner/$Repo/actions" }

  Step 'Downloading installer'
  $dl = Join-Path $PSScriptRoot 'release-download'
  gh release download "v$Version" --repo "$Owner/$Repo" --pattern '*.exe' --dir $dl --clobber
  $exe = Get-ChildItem $dl -Filter '*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  Write-Host ''
  Write-Host 'Done.' -ForegroundColor Green
  Write-Host "Releases: https://github.com/$Owner/$Repo/releases"
  Write-Host 'Install the app from the installer. You can then delete the portable version: progress and repertoire stay in Documents.'
  if ($exe) { Start-Process $exe.FullName }
} catch {
  Write-Host ''
  Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
