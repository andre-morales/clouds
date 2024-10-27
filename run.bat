@echo off
setlocal EnableDelayedExpansion

IF NOT EXIST "api\runtime\core.mjs" (
	echo :: Building API
	echo.
	call yarn build-api-dist
)

IF NOT EXIST "client\public\pack\shared.chk.js" (
	echo :: Building Core
	echo.
	call yarn build-client-prod
)

IF NOT EXIST "client\public\pack\platform.chk.js" (
	echo :: Building Apps
	echo.
	call yarn build-apps-prod
)

node --enable-source-maps . %*