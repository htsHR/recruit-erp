$ErrorActionPreference = 'Stop'

if (-not [Environment]::Is64BitProcess -or $env:OS -ne 'Windows_NT') {
  throw 'Windows x64 Node.js에서만 Bridge 실행파일을 만들 수 있습니다.'
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$distDir = Join-Path $projectRoot 'dist'
$sourcePath = Join-Path $PSScriptRoot 'erp-bridge.js'
$configTemplatePath = Join-Path $PSScriptRoot 'sea-config.json'
$bridgeConfigPath = Join-Path $PSScriptRoot 'bridge-config.example.json'
$postjectPath = Join-Path $projectRoot 'node_modules\.bin\postject.cmd'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$placeholder = '__ERP_BRIDGE_BUILD_ORIGIN__'

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

function New-BridgeExecutable {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$AllowedOrigin,
    [Parameter(Mandatory = $true)][string]$OutputName
  )

  $exePath = Join-Path $distDir $OutputName
  $generatedSourcePath = Join-Path $distDir "erp-bridge-$Name.js"
  $generatedConfigPath = Join-Path $distDir "sea-config-$Name.json"
  $blobPath = Join-Path $distDir "erp-bridge-$Name.blob"

  $source = Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8
  if (-not $source.Contains($placeholder)) { throw 'Bridge Origin 빌드 표식을 찾을 수 없습니다.' }
  $source = $source.Replace($placeholder, $AllowedOrigin)
  Set-Content -LiteralPath $generatedSourcePath -Value $source -Encoding UTF8

  $seaConfig = Get-Content -LiteralPath $configTemplatePath -Raw -Encoding UTF8 | ConvertFrom-Json
  $seaConfig.main = $generatedSourcePath
  $seaConfig.output = $blobPath
  $seaConfig | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $generatedConfigPath -Encoding UTF8

  Remove-Item -LiteralPath $exePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $blobPath -Force -ErrorAction SilentlyContinue

  try {
    & $nodePath --experimental-sea-config $generatedConfigPath
    if ($LASTEXITCODE -ne 0) { throw "$Name SEA 준비 파일 생성에 실패했습니다." }

    Copy-Item -LiteralPath $nodePath -Destination $exePath
    & $postjectPath $exePath NODE_SEA_BLOB $blobPath --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
    if ($LASTEXITCODE -ne 0) { throw "$Name 실행파일 생성에 실패했습니다." }
  } finally {
    Remove-Item -LiteralPath $blobPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $generatedSourcePath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $generatedConfigPath -Force -ErrorAction SilentlyContinue
  }

  if (-not (Test-Path -LiteralPath $exePath)) { throw "$OutputName 파일이 생성되지 않았습니다." }
  Write-Host "생성 완료: $exePath ($AllowedOrigin)"
}

Push-Location $projectRoot
try {
  New-BridgeExecutable -Name 'preview' -AllowedOrigin 'https://recruit-erp-git-agent-shared-folder-storage-test-htserp.vercel.app' -OutputName 'ERP-Bridge-Preview.exe'
  New-BridgeExecutable -Name 'production' -AllowedOrigin 'https://recruit-erp.vercel.app' -OutputName 'ERP-Bridge.exe'
  Copy-Item -LiteralPath $bridgeConfigPath -Destination (Join-Path $distDir 'bridge-config.json') -Force
} finally {
  Pop-Location
}
