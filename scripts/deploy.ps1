# GitHub Pages への手動デプロイ
# 使い方: powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
$ErrorActionPreference = "Stop"
$repo = "https://github.com/mogurumogana-beep/tenki-ikusei.git"

$env:VITE_BASE = "/tenki-ikusei/"
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }
Remove-Item Env:VITE_BASE

New-Item -ItemType File -Force dist\.nojekyll | Out-Null
Push-Location dist
try {
  if (Test-Path .git) { Remove-Item -Recurse -Force .git }
  git init -b gh-pages
  git config user.name "mogurumogana-beep"
  git config user.email "mogurumogana-beep@users.noreply.github.com"
  git add -A
  git commit -m "Deploy to GitHub Pages"
  git push -f $repo gh-pages
} finally {
  Pop-Location
}
Write-Output "deployed: https://mogurumogana-beep.github.io/tenki-ikusei/"
