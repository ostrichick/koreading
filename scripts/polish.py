from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
def read(p): return (root/p).read_text(encoding='utf-8')
def write(p,s): (root/p).write_text(s,encoding='utf-8')
for p in ['src/app/read/guest/page.tsx','src/components/reader/ArticleReader.tsx']:
    s=read(p).replace('useState, useEffect,', 'useState, useEffect, useCallback,')
    line="  const { wordData, loadingWord, loadingAdvanced, lookupError, fetchWordData, clearWord } = useWordLookup(profile?.nativeLanguage || getGuestLang());\n"
    s=s.replace(line,'')
    a=s.index('  const router = useRouter();')+len('  const router = useRouter();')
    s=s[:a]+"\n  const [guestNativeLang, setGuestNativeLang] = useState<import('@/lib/gemini').NativeLanguage>('en');\n  useEffect(() => setGuestNativeLang(getGuestLang()), []);\n"+line.replace('getGuestLang()', 'guestNativeLang')+s[a:]
    a=s.index('  const closePopup ='); b=s.index('\n  };',a)+len('\n  };')
    block=s[a:b].replace('= () => {','= useCallback(() => {').replace('\n  };','\n  }, [clearWord]);')
    s=s[:a]+s[b:]
    a=s.index('  // 🎙️'); s=s[:a]+block+'\n\n'+s[a:]
    s=s.replace('[id, user, router, initialArticle]', '[id, user, router, initialArticle, closePopup]').replace('  }, [router]);', '  }, [router, closePopup]);')
    s=s.replace('profile?.nativeLanguage || getGuestLang()', 'profile?.nativeLanguage || guestNativeLang')
    write(p,s)
for p,var in [('src/hooks/useWordLookup.ts','sequence'),('src/components/reader/TutorPanel.tsx','generation')]:
    s=read(p).replace(f'return () => {{ {var}.current++; }};', f'const epoch = {var}.current; return () => {{ {var}.current = epoch + 1; }};')
    write(p,s)
p='src/app/library/page.tsx'; s=read(p).replace('    return () => { requestId.current++; loadLock.current = false; };','    const epoch = requestId.current;\n    return () => { requestId.current = epoch + 1; loadLock.current = false; };'); write(p,s)
p='src/lib/db.ts'; s=read(p)
s=re.sub(r'/\*\*\n \* 사용자의 회원 탈퇴를 처리합니다\.[\s\S]*?\*/', '/** Authenticated server cleanup deletes personal data before the Auth account. */',s)
write(p,s)
p='src/app/test/page.tsx';s=read(p).replace('약 10~20초 소요','모델 상태에 따라 시간이 걸릴 수 있습니다.').replace('테스트 완료!', '시작 난이도 추천 완료!')
s=s.replace('          {/* E2E 테스트', '          <p>연습용 추천이며 공인 한국어 능력 평가가 아닙니다. 프로필에서 난이도를 바꿀 수 있습니다.</p>\n          {/* E2E 테스트')
write(p,s)
# Keep modern directives as the first statement.
p='src/app/test/page.tsx';s=read(p); s=s.replace("import { recommendLevel } from '@/lib/learning';\n",''); s=s.replace("'use client';", "'use client';\nimport { recommendLevel } from '@/lib/learning';");write(p,s)
for p in ['src/app/api/ai/route.ts','src/lib/gemini.ts']:
    s=read(p)
    s=s.replace('실시간', '응답 완료 후').replace('2026년 현재 100% 가동 검증된 최신 고속', '설정된').replace('Gemini 5종', 'Gemini 4종').replace('Groq 3종', 'Groq 2종').replace('최대 8중', '최대 6중').replace('총 8개', '총 6개')
    s=s.replace('일일 20회 제한 없이 무제한', '서비스 한도 내')
    write(p,s)
p='src/app/api/ai/route.ts'; s=read(p)
s=re.sub(r'/\*\*[\s\S]*?\*/', '/** Server AI gateway: validation, shared quotas, bounded provider attempts. */', s, count=1)
s=s.replace('// Edge Runtime: Vercel 엣지 네트워크에서 직접 실행 → 콜드 스타트 제거, 응답 지연 최소화', '// Node.js runtime supports verified Firebase identities and shared Firestore quotas.')
write(p,s)
