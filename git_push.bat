@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: display grammatical word structure analysis with skeleton pulses in lookup popup card"
%GIT% push origin main
echo PUSH_DONE
