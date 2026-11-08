<#
.SYNOPSIS
  DeskMate 开发启动脚本（Windows / PowerShell）。

.DESCRIPTION
  处理改名后的新流程：
  - 可执行文件为 deskmate.exe；
  - 数据目录已迁移到 %APPDATA%\deskmate 与 文档\DeskMate（旧目录自动复制迁移）；
  - 桌面小窗合并为单个 agenda-widget 窗口，启动后自动恢复。

.EXAMPLE
  .\start-deskmate.ps1
  以开发模式启动（热更新）。

.EXAMPLE
  .\start-deskmate.ps1 -Release
  打正式安装包并安装。

.EXAMPLE
  .\start-deskmate.ps1 -Preview
  只启动前端预览（浏览器打开 http://localhost:1420/preview/agenda.html）。
#>
param(
  [switch]$Release,
  [switch]$Preview
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# 1) 保证 cargo 在 PATH 里（Rust 工具链装在用户目录）
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) {
  $env:PATH = "$cargoBin;$env:PATH"
}

# 2) 找 npm：优先系统 Node，回退到 WorkBuddy 内置 Node
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if (-not $npm) {
  $fallback = Get-ChildItem "$env:USERPROFILE\.workbuddy\binaries\node\versions" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "npm.cmd" } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1
  if (-not $fallback) {
    throw "找不到 npm，请先安装 Node.js 或把 node 装进 PATH。"
  }
  $npm = $fallback
}

# 3) 清理改名后残留的旧进程（避免占用端口或文件锁）
Get-Process -Name "deskmate" -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "DeskMate 开发启动中…（Ctrl+C 停止）" -ForegroundColor Green
Write-Host "  项目目录 : $root"
Write-Host "  npm      : $npm"

if ($Preview) {
  & $npm run dev
  Write-Host "预览地址 : http://localhost:1420/preview/agenda.html" -ForegroundColor Cyan
  exit 0
}

if ($Release) {
  & $npm run tauri build
  Write-Host "安装包已生成于 src-tauri\target\release\bundle" -ForegroundColor Cyan
  exit 0
}

& $npm run tauri dev
