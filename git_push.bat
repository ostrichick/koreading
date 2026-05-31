@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: implement robust model fallback (2.5-flash -> 1.5-flash) to bypass daily free-tier quota limits"
%GIT% push origin main
echo PUSH_DONE
