@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: set default topics to empty and persist generation modal selections in localStorage"
%GIT% push origin main
echo PUSH_DONE
