@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: streaming NDJSON article generation with real-time model status logs and exponential backoff retry for 503/429 errors"
%GIT% push origin main
echo PUSH_DONE
