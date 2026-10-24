@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; assert sys.version_info >= (3,9)" >nul 2>nul
  if not errorlevel 1 (
    py -3 scripts\preview.py
    goto done
  )
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; assert sys.version_info >= (3,9)" >nul 2>nul
  if not errorlevel 1 (
    python scripts\preview.py
    goto done
  )
)
echo Python 3.9 or newer was not found. Install Python 3 and run this file again.
:done
pause

