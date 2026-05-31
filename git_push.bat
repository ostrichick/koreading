@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: support progressive double-stage lookup with skeletons on guest read page"
%GIT% push origin main
echo PUSH_DONE
