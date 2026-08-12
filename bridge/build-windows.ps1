$ErrorActionPreference = 'Stop'

if (-not [Environment]::Is64BitProcess -or $env:OS -ne 'Windows_NT') {
  throw 'Windows x64 Node.js에서만 Bridge 실행파일을 만들 수 있습니다.'
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$distDir = Join-Path $projectRoot 'dist'
$exePath = Join-Path $distDir 'ERP-Bridge-Test.exe'
$blobPath = Join-Path $distDir 'erp-bridge-sea.blob'
$configPath = Join-Path $PSScriptRoot 'sea-config.json'
$postjectPath = Join-Path $projectRoot 'node_modules\.bin\postject.cmd'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Remove-Item -LiteralPath $exePath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $blobPath -Force -ErrorAction SilentlyContinue

Push-Location $projectRoot
try {
  & $nodePath --experimental-sea-config $configPath
  if ($LASTEXITCODE -ne 0) { throw 'SEA 준비 파일 생성에 실패했습니다.' }

  Copy-Item -LiteralPath $nodePath -Destination $exePath
  & $postjectPath $exePath NODE_SEA_BLOB $blobPath --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
  if ($LASTEXITCODE -ne 0) { throw 'SEA 실행파일 생성에 실패했습니다.' }
} finally {
  Pop-Location
  Remove-Item -LiteralPath $blobPath -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $exePath)) { throw 'ERP-Bridge-Test.exe가 생성되지 않았습니다.' }
Write-Host "생성 완료: $exePath"
