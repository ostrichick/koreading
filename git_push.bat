@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: migrate primary Groq engine to gemma2-9b-it for superior Korean and pure constraint compliance"
%GIT% push origin main
echo PUSH_DONE
