@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: lower LLM temperature to 0.1 and strictly forbid parenthetical annotations to prevent code-switching"
%GIT% push origin main
echo PUSH_DONE
