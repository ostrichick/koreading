@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: switch model to gemini-2.5-flash to fix 404 deprecation error"
%GIT% push origin main
echo PUSH_DONE
