@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: increase target character count ranges across all CEFR levels to ensure substantial reading texts and estimate reading minutes dynamically"
%GIT% push origin main
echo PUSH_DONE
