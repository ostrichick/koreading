@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: add special storytelling constraint for fairy-tales topic to enforce fiction creation instead of explanatory articles"
%GIT% push origin main
echo PUSH_DONE
