@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: apply strict pure Korean hard constraints in generation prompt to stop Llama mixing foreign languages"
%GIT% push origin main
echo PUSH_DONE
