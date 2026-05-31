@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: bypass Firestore composite index via client-side sorting and improve library generation alerts"
%GIT% push origin main
echo PUSH_DONE
