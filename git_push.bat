@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "fix: integrate system-level instructions in Groq and Gemini models to completely suppress Japanese and non-Korean leaks"
%GIT% push origin main
echo PUSH_DONE
