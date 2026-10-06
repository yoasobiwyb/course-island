$ErrorActionPreference = "Stop"

# 课程岛 Windows 启动器。PowerShell 版本适合需要查看启动日志的用户。
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$site = Join-Path $root "dist"
$onlineUrl = "https://yoasobiwyb.github.io/course-island/"

if (-not (Test-Path (Join-Path $site "index.html"))) {
    Write-Host "未找到本地构建文件，正在打开课程岛在线版……"
    Start-Process $onlineUrl
    exit 0
}

$python = Get-Command py -ErrorAction SilentlyContinue
$pythonArgs = @("-3", "-m", "http.server", "5173")
if (-not $python) {
    $python = Get-Command python -ErrorAction SilentlyContinue
    $pythonArgs = @("-m", "http.server", "5173")
}

if (-not $python) {
    Write-Warning "这台电脑没有找到 Python 3，将打开课程岛在线版。"
    Start-Process $onlineUrl
    exit 0
}

$server = Start-Process -FilePath $python.Source -ArgumentList $pythonArgs -WorkingDirectory $site -PassThru
Start-Sleep -Milliseconds 700
Start-Process "http://127.0.0.1:5173/"
Write-Host "课程岛已启动。服务进程 ID：$($server.Id)"
Write-Host "关闭本窗口或结束该进程即可停止本地服务。"
