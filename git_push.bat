@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: persistent guest articles, article rating/comment systems, rating sorting, and checkbox modal filters for generation"
%GIT% push origin main
echo PUSH_DONE
