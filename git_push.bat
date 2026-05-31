@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: guest mode - no login required for test and reading"
%GIT% push origin main
echo PUSH_DONE
