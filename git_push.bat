@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: completely localize system instructions and prompts to Korean to eradicate multilingual token leakage"
%GIT% push origin main
echo PUSH_DONE
