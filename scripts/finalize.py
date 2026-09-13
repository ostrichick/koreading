from pathlib import Path
import json,re
r=Path(__file__).resolve().parents[1]
def edit(p,fn):
    path=r/p; path.write_text(fn(path.read_text(encoding='utf-8')),encoding='utf-8')
def packages(s):
    p=json.loads(s)
    p['dependencies']['firebase']='^12.19.0'
    p['dependencies']['firebase-admin']='^14.4.0'
    p['devDependencies']['@firebase/rules-unit-testing']='^5.0.2'
    p['devDependencies']['eslint']='^9.39.0'
    p['devDependencies']['eslint-config-next']='16.3.5'
    p['scripts'].update({'test':'node --import tsx --test tests/*.test.ts','test:integration':'node --require ./tests/server-only.cjs --import tsx --test tests/security.integration.ts','test:emulators':'npx firebase-tools emulators:exec --only firestore,auth --project demo-koreading "npm run test:integration"','test:browser':'playwright test','typecheck':'tsc --noEmit --incremental false'})
    return json.dumps(p,indent=2)+'\n'
edit('package.json',packages)
edit('.gitignore',lambda s:s+'\n.verification/\nplaywright-report/\ntest-results/\n.firebase/\n.env\n.env.*\n!.env.local.example\n')
edit('src/components/reader/ArticleReader.tsx',lambda s:s.replace(": getGuestLang();", ': guestNativeLang;'))
edit('src/app/read/[id]/page.tsx',lambda s:s.replace('`${article.title} | Koreading`','article.title'))
edit('src/app/library/page.tsx',lambda s:re.sub(r'        helpfulGuide = `🚨.*?`;','        helpfulGuide = `AI 사용 한도에 도달했습니다. 서비스 또는 제공사 한도이며, 초기화 후 다시 시도해 주세요.${logBlock}`;',s,flags=re.S))
edit('src/app/library/page.tsx',lambda s:re.sub(r'        helpfulGuide = `⏳.*?`;','        helpfulGuide = `유효한 AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.${logBlock}`;',s,flags=re.S))
edit('src/app/api/ai/route.ts',lambda s:s.replace('현재 모든 AI 서버가 과부하 상태입니다. 1~2분 후에 다시 시도해 주세요.\\n\\n💡 개인 Gemini API Key를 등록하면 개인 쿼터를 사용하므로 성공률이 크게 높아집니다!', '요청한 조건을 충족하는 AI 응답을 받지 못했습니다. 제공사 오류 또는 출력 검증 실패입니다. 잠시 후 다시 시도해 주세요.'))
edit('src/app/api/ai/route.ts',lambda s:s.replace('5개의 핵심 어휘(keyVocabulary)는 본문 속에서 각각 최소 2회 이상 자연스럽게 반복(Recycled)되어야 합니다.', '5개의 핵심 어휘(keyVocabulary)는 본문에 실제로 쓰인 동일한 표기 형태로 골라 각각 최소 2회 이상 자연스럽게 반복하십시오. 활용형이 다르면 반복으로 세지 않습니다.'))
for name in ['check-models','monthly-model-audit']:
    edit(f'src/app/api/cron/{name}/route.ts', lambda s:s.replace("export const runtime = 'edge';", "export const runtime = 'nodejs';\nexport const maxDuration = 180;"))
edit('.env.local.example',lambda s:s+'''\n# Server-only: Firebase service account JSON with Auth/Firestore permissions.
# Never prefix these variables with NEXT_PUBLIC_ or commit a real credential.
FIREBASE_SERVICE_ACCOUNT_JSON=
CRON_SECRET=
AI_GUEST_SECRET=
# Global daily provider-attempt units (not currency). Defaults to 1000.
AI_DAILY_BUDGET=1000
''')
