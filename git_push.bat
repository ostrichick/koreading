@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: history topic focuses on specific era/event/figure instead of generic overview"
%GIT% push origin main
echo PUSH_DONE
