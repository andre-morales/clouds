@echo off
SETLOCAL EnableDelayedExpansion

IF NOT EXIST "api\dist\core.mjs" (
	echo :: Building API
	echo.
	call pnpm api:build
)

IF NOT EXIST "client\public\pack\core.chk.js" (
	echo :: Building Core
	echo.
	call pnpm client:build:prod
)

IF NOT EXIST "apps\about\dist\app.pack.js" (
	echo :: Building Apps
	echo.
	call pnpm apps:build:prod
)

:run
node --enable-source-maps --watch-path api/dist . %*
if %errorlevel% EQU 777 goto exit
if %errorlevel% EQU 778 goto exit
echo Server TERMINATED. Will restart soon. - %date% %time%
timeout /t 2 /nobreak > nul
goto run

:exit

