@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: replace native browser alerts with premium draggable and selectable AlertModal"
%GIT% push origin main
echo PUSH_DONE
