@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: support test-mode article deletion inside reading pages for bad quality texts"
%GIT% push origin main
echo PUSH_DONE
