@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: add Groq Llama 3.3/3.1 fallbacks, switch to JSON logs, 8-model resilient chain"
%GIT% push origin main
echo PUSH_DONE
