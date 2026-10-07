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
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "Не знайдено $name і winget. Встанови $name вручну і запусти скрипт ще раз." }
  Write-Host "Встановлюю $name через winget..."
  winget install --id $id -e --source winget --accept-source-agreements --accept-package-agreements | Out-Host
  RefreshPath
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$name встановлено, але команда $cmd ще не видна. Закрий вікно і запусти скрипт ще раз." }
}
function Invoke-Git { & (Get-Command git -CommandType Application | Select-Object -First 1) @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') завершився з помилкою" } }

try {
  Step 'Перевіряю Git і GitHub CLI'
  Need git 'Git.Git' 'Git'
  Need gh 'GitHub.cli' 'GitHub CLI'

  Step 'Вхід у GitHub'
  gh auth status *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Зараз відкриється браузер. Скопіюй одноразовий код, який покаже це вікно, і підтверди вхід у свій обліковий запис GitHub.'
    gh auth login --hostname github.com --git-protocol https --web --scopes 'repo,workflow'
    if ($LASTEXITCODE -ne 0) { throw 'Вхід у GitHub не завершено.' }
  }
  gh auth setup-git | Out-Null
  $Owner = (gh api user --jq .login).Trim()
  Write-Host "Обліковий запис: $Owner"

  Step 'Налаштовую package.json'
  $pkgText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'package.json'))
  if ($pkgText -match 'YOUR_GITHUB_NAME') { $pkgText = $pkgText -replace 'YOUR_GITHUB_NAME', $Owner; [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'package.json'), $pkgText, $NoBom) }
  $Version = ($pkgText | ConvertFrom-Json).version
  Write-Host "Версія: $Version"

  Step 'Готую локальний репозиторій'
  if (-not (Test-Path .git)) { Invoke-Git init -b main | Out-Null }
  if (-not (git config user.name)) { $n = (gh api user --jq '.name // .login').Trim(); Invoke-Git config user.name "$n" }
  if (-not (git config user.email)) { $uid = (gh api user --jq .id).Trim(); Invoke-Git config user.email "$uid+$Owner@users.noreply.github.com" }
  Invoke-Git add -A
  git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { Invoke-Git commit -m "Репетитор EWI $Version" | Out-Null }

  Step "Створюю публічний репозиторій $Owner/$Repo"
  gh repo view "$Owner/$Repo" *> $null
  if ($LASTEXITCODE -ne 0) {
    gh repo create $Repo --public --description 'Репетитор гри на Akai EWI Solo' --source . --remote origin --push
    if ($LASTEXITCODE -ne 0) { throw 'Не вдалося створити репозиторій.' }
  } else {
    Write-Host 'Репозиторій уже існує, оновлюю його.'
    if (-not (git remote)) { Invoke-Git remote add origin "https://github.com/$Owner/$Repo.git" }
    Invoke-Git push -u origin main
  }

  Step "Запускаю збірку інсталятора v$Version"
  git rev-parse "v$Version" *> $null; if ($LASTEXITCODE -ne 0) { Invoke-Git tag "v$Version" }
  Invoke-Git push origin "v$Version"
  Write-Host 'GitHub збирає інсталятор, це займає 5–10 хвилин.'
  $run = $null
  for ($i = 0; $i -lt 30 -and -not $run; $i++) { Start-Sleep 5; $runs = gh run list --workflow release.yml --limit 5 --json databaseId,headBranch | ConvertFrom-Json; $run = ($runs | Where-Object { $_.headBranch -eq "v$Version" } | Select-Object -First 1).databaseId }
  if ($run) { gh run watch $run --exit-status; if ($LASTEXITCODE -ne 0) { throw "Збірка завершилась з помилкою. Подробиці: https://github.com/$Owner/$Repo/actions" } }
  else { Write-Host "Не дочекався запуску збірки. Перевір вручну: https://github.com/$Owner/$Repo/actions" }

  Step 'Завантажую інсталятор'
  $dl = Join-Path $PSScriptRoot 'release-download'
  gh release download "v$Version" --repo "$Owner/$Repo" --pattern '*.exe' --dir $dl --clobber
  $exe = Get-ChildItem $dl -Filter '*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  Write-Host ''
  Write-Host 'Готово.' -ForegroundColor Green
  Write-Host "Релізи: https://github.com/$Owner/$Repo/releases"
  Write-Host 'Встанови програму з інсталятора. Портативну версію після цього можна видалити: прогрес і репертуар лишаються в Документах.'
  if ($exe) { Start-Process $exe.FullName }
} catch {
  Write-Host ''
  Write-Host "Помилка: $($_.Exception.Message)" -ForegroundColor Red
}
