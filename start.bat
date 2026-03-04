@echo off
echo ==========================================
echo   MEGAZUL - Iniciando servidor...
echo ==========================================

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ERRO: Node.js nao encontrado.
  echo Instale em: https://nodejs.org
  pause
  exit /b 1
)

cd /d "%~dp0"

if not exist node_modules (
  echo Instalando dependencias...
  npm install
  echo.
)

echo Servidor iniciando em http://localhost:3000
echo.
node server.js
pause
