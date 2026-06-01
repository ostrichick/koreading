@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: K-content topic now picks a specific famous drama/movie/book/kpop instead of generic overview"
%GIT% push origin main
echo PUSH_DONE
