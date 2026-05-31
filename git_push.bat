@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: enforce 100% pure Korean in dictionary word lookup definitions to block foreign language leaks"
%GIT% push origin main
echo PUSH_DONE
