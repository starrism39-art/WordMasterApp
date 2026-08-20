param(
  [Parameter(Mandatory=$true)]
  [string]$LocalFile,

  [Parameter(Mandatory=$true)]
  [string]$CloudPath,

  [string]$EnvId = "cloudbase-4gafzdch60ad597b",

  [switch]$Execute
)

$ErrorActionPreference = "Stop"

$resolvedLocalFile = Resolve-Path -LiteralPath $LocalFile
if (-not $CloudPath.StartsWith("wordbooks/")) {
  throw "CloudPath must stay under wordbooks/."
}

$cacheRoot = "C:\Users\15189\Documents\Codex\2026-08-10\referenced-chatgpt-conversation-this-is-an\.npm-cloudbase"
$env:npm_config_cache = $cacheRoot

Write-Host "WordMaster CloudBase wordbook upload"
Write-Host "Local file: $resolvedLocalFile"
Write-Host "Cloud path: $CloudPath"
Write-Host "Env ID: $EnvId"

$existing = npx --yes --package '@cloudbase/cli' tcb storage list $CloudPath --env-id $EnvId 2>$null
if ($LASTEXITCODE -eq 0 -and ($existing -join "`n") -match [regex]::Escape($CloudPath)) {
  throw "Cloud object already exists: $CloudPath. Refusing to overwrite."
}

if (-not $Execute) {
  Write-Host "Dry run only. Re-run with -Execute to upload."
  exit 0
}

npx --yes --package '@cloudbase/cli' tcb storage upload $resolvedLocalFile $CloudPath --env-id $EnvId
if ($LASTEXITCODE -ne 0) {
  throw "CloudBase upload failed."
}

Write-Host "Upload complete."
