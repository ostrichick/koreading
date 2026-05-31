@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: implement secure client-side custom API key delegation to bypass Gemini daily quota limits"
%GIT% push origin main
echo PUSH_DONE
