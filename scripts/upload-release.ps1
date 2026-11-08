<#
.SYNOPSIS
  把 release/ 目录中的 Windows x64 exe 上传到 GitHub Releases。

.DESCRIPTION
  若指定 Tag 的 Release 不存在则先创建，再逐个上传 exe 资产。
  Token 只用于本次请求头，不写入任何文件；请勿把 PAT 提交到仓库。

.EXAMPLE
  .\scripts\upload-release.ps1 -Token "ghp_xxx"
  在受限网络（代理证书不受信）下追加 -Insecure。
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Token,
  [string]$Tag = "v1.2.0",
  [string]$Repo = "Ahazjh/DeskMate",
  [string]$AssetsDir = "",
  [switch]$Insecure
)

$ErrorActionPreference = "Stop"

if (-not $AssetsDir) {
  $root = Split-Path -Parent $MyInvocation.MyCommand.Path
  $AssetsDir = Join-Path (Split-Path -Parent $root) "release"
}
$assets = Get-ChildItem -LiteralPath $AssetsDir -Filter "*.exe" -File -ErrorAction Stop
if ($assets.Count -eq 0) {
  throw "release 目录里没有 exe：$AssetsDir"
}

$curl = @("-sS", "-L")
if ($Insecure) { $curl += "-k" }
$headers = @(
  "-H", "Authorization: Bearer $Token",
  "-H", "Accept: application/vnd.github+json",
  "-H", "X-GitHub-Api-Version: 2022-11-28"
)
$api = "https://api.github.com/repos/$Repo/releases"

$statusFile = Join-Path $env:TEMP "deskmate-release-status.txt"
$bodyFile = Join-Path $env:TEMP "deskmate-release-body.json"
$code = & curl.exe @curl @headers -o $bodyFile -w "%{http_code}" "$api/tags/$Tag"
$code = ($code | Out-String).Trim()

if ($code -eq "200") {
  $release = Get-Content -LiteralPath $bodyFile -Raw | ConvertFrom-Json
  Write-Host "复用已有 Release：$($release.html_url)" -ForegroundColor Green
} elseif ($code -eq "404") {
  $payload = @{
    tag_name = $Tag
    name = "DeskMate $Tag"
    body = "Windows x64 only. See README for details."
    draft = $false
    prerelease = $false
  } | ConvertTo-Json -Compress
  $payloadFile = Join-Path $env:TEMP "deskmate-release-create.json"
  [System.IO.File]::WriteAllText($payloadFile, $payload, [System.Text.Encoding]::UTF8)
  $createCode = & curl.exe @curl @headers -X POST -H "Content-Type: application/json" --data-binary "@$payloadFile" -o $bodyFile -w "%{http_code}" $api
  $createCode = ($createCode | Out-String).Trim()
  if ($createCode -ne "201") {
    throw "创建 Release 失败（HTTP $createCode）：$(Get-Content -LiteralPath $bodyFile -Raw)"
  }
  $release = Get-Content -LiteralPath $bodyFile -Raw | ConvertFrom-Json
  Write-Host "已创建 Release：$($release.html_url)" -ForegroundColor Green
} else {
  throw "查询 Release 失败（HTTP $code）：$(Get-Content -LiteralPath $bodyFile -Raw)"
}

foreach ($file in $assets) {
  $name = [uri]::EscapeDataString($file.Name)
  $upload = "https://uploads.github.com/repos/$Repo/releases/$($release.id)/assets?name=$name"
  $resultFile = Join-Path $env:TEMP "deskmate-upload-result.json"
  $assetCode = & curl.exe @curl @headers -X POST `
    -H "Content-Type: application/octet-stream" `
    --data-binary "@$($file.FullName)" `
    -o $resultFile -w "%{http_code}" $upload
  $assetCode = ($assetCode | Out-String).Trim()
  if ($assetCode -eq "201") {
    Write-Host "已上传：$($file.Name)" -ForegroundColor Green
  } elseif ($assetCode -eq "422") {
    Write-Host "已存在，跳过：$($file.Name)" -ForegroundColor Yellow
  } else {
    throw "上传 $($file.Name) 失败（HTTP $assetCode）：$(Get-Content -LiteralPath $resultFile -Raw)"
  }
}

Write-Host "完成：$($release.html_url)" -ForegroundColor Cyan
