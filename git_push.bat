@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: reinforce absolute pure Korean constraints in article generation to suppress multilingual and translation leaks"
%GIT% push origin main
echo PUSH_DONE
