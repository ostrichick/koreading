@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: update Groq API model name to llama-3.3-70b-versatile to support active production models"
%GIT% push origin main
echo PUSH_DONE
