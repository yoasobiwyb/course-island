@echo off
setlocal

rem 课程岛 Windows 启动器：有 dist 时本地运行，否则打开在线版。
set "ROOT=%~dp0"
set "SITE=%ROOT%dist"
set "URL=https://yoasobiwyb.github.io/course-island/"

if not exist "%SITE%\index.html" (
  echo 未找到本地构建文件，正在打开课程岛在线版……
  start "" "%URL%"
  exit /b 0
)

where py >nul 2>&1
if %errorlevel%==0 goto start_py
where python >nul 2>&1
if %errorlevel%==0 goto start_python

echo 这台电脑没有找到 Python 3。
echo 你仍可以使用课程岛在线版：%URL%
choice /c YN /n /m "是否现在打开在线版？[Y/N] "
if %errorlevel%==1 start "" "%URL%"
exit /b 0

:start_py
start "课程岛本地服务" /D "%SITE%" cmd /k "py -3 -m http.server 5173"
goto open_browser

:start_python
start "课程岛本地服务" /D "%SITE%" cmd /k "python -m http.server 5173"

:open_browser
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:5173/"
echo 课程岛已启动。请保留弹出的服务窗口，关闭它即可停止本地服务。
exit /b 0
