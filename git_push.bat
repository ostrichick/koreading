@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: display generator model name badge on both user and guest reading pages"
%GIT% push origin main
echo PUSH_DONE
