@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: enforce cohesive paragraph structure and prevent single-sentence lines in article generation"
%GIT% push origin main
echo PUSH_DONE
