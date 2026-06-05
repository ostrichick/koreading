@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
%GIT% add -A
%GIT% commit -m "feat: all 8 topics get specific instructions, add language selector (EN/ES/JA/ZH) to library header"
%GIT% push origin main
echo PUSH_DONE
