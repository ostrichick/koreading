@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: add special travel destination description constraint for nature-travel topic"
%GIT% push origin main
echo PUSH_DONE
