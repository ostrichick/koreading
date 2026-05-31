@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: add debounced hover-lookup settings toggle and premium pulsing skeleton loaders in dictionary modals"
%GIT% push origin main
echo PUSH_DONE
