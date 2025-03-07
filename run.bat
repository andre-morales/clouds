@echo off
SETLOCAL EnableDelayedExpansion

IF NOT EXIST "api\dist\core.mjs" (
	echo :: Building API
	echo.
	call yarn build-api-dist
)

IF NOT EXIST "client\public\pack\core.chk.js" (
	echo :: Building Core
	echo.
	call yarn build-client-prod
)

IF NOT EXIST "apps\about\dist\app.pack.js" (
	echo :: Building Apps
	echo.
	call yarn build-apps-prod
)

:run
node --enable-source-maps --watch . %*
if %errorlevel% EQU 777 goto exit
if %errorlevel% EQU 778 goto exit
echo Server TERMINATED. Will restart. - %date% %time%
goto run

:exit

