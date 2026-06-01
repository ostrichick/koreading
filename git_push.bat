@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: expand fallback chain to 6 AI models (Groq + 5 Gemini variants) with retry to maximize 503 resilience"
%GIT% push origin main
echo PUSH_DONE
