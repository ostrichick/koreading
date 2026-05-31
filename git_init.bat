@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% config --global user.email "user@example.com"
%GIT% config --global user.name "Korean Reading App"
%GIT% init
%GIT% add .
%GIT% commit -m "Initial commit: Korean reading app"
echo DONE
