@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: rebrand to Korider - logo, name, bilingual landing page"
%GIT% push origin main
echo PUSH_DONE
