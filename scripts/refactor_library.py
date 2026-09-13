from pathlib import Path
import re, json
root=Path(__file__).resolve().parents[1]
def read(p): return (root/p).read_text(encoding='utf-8')
def write(p,s):
    path=root/p; path.parent.mkdir(parents=True,exist_ok=True); path.write_text(s,encoding='utf-8')
write('src/app/read/[id]/page.tsx', '''import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { publicArticle } from '@/lib/server/publicArticles';
import ArticleReader from '@/components/reader/ArticleReader';
const getArticle = cache(publicArticle);
export const revalidate = 60;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const article = await getArticle((await params).id);
  if (!article) return { title: 'Reading not found', robots: { index: false } };
  const url = `https://koreading.vercel.app/read/${article.id}`;
  const description = article.summaries?.en || article.summary || article.content.slice(0, 160);
  return { title: `${article.title} | Koreading`, description, alternates: { canonical: url }, openGraph: { title: article.title, description, url, type: 'article' } };
}
export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const article = await getArticle((await params).id);
  if (!article) notFound();
  return <ArticleReader key={article.id} initialArticle={article} />;
}
''')
for p in ['src/app/read/guest/page.tsx','src/components/reader/ArticleReader.tsx']:
    s=read(p).replace("import { useWordLookup }", "import { isKoreanWord } from '@/lib/utils';\nimport { useWordLookup }")
    write(p,s)
p='src/app/library/page.tsx'; s=read(p)
s=s.replace('getArticlesByLevel, getAllArticles, ', '')
s=s.replace("import AlertModal from", "import { articleSummary } from '@/lib/learning';\nimport AlertModal from")
s=s.replace('const articleCacheRef = useRef<Record<string, Article[]>>({});', "const articleCacheRef = useRef<Record<string, Article[]>>({});\n  const [nextCursor, setNextCursor] = useState<string | null>(null);\n  const [listError, setListError] = useState('');\n  const requestId = useRef(0);\n  const loadLock = useRef(false);")
s=s.replace("const { user, profile, refreshProfile } = useAuth();", "const { user, profile, loading: authLoading, refreshProfile } = useAuth();")
s=s.replace("    const level = profile?.level || getGuestLevel();\n    if (!level) {\n      router.push('/test');\n      return;\n    }", "    if (authLoading) return;\n    const level = profile?.level || getGuestLevel() || 'A1';")
s=s.replace('  }, [profile, router]);', '  }, [profile, router, authLoading]);')
a=s.index('  const loadArticles ='); b=s.index('  // 로그인 회원일 경우',a)
s=s[:a]+'''  const loadArticles = useCallback(async (cursor?: string) => {
    if (cursor && loadLock.current) return;
    loadLock.current = true;
    const id = ++requestId.current;
    setLoadingArticles(true); setListError('');
    try {
      const query = new URLSearchParams({ level: selectedLevel, topic: selectedTopic, sort: sortBy });
      if (cursor) query.set('cursor', cursor);
      const response = await fetch(`/api/library?${query}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load library');
      if (id !== requestId.current) return;
      setArticles(previous => cursor ? [...previous, ...result.articles.filter((a: Article) => !previous.some(p => p.id === a.id))] : result.articles);
      setNextCursor(result.cursor);
    } catch (error) {
      if (id === requestId.current) setListError(error instanceof Error ? error.message : 'Please retry');
    } finally { if (id === requestId.current) { setLoadingArticles(false); loadLock.current = false; } }
  }, [selectedLevel, selectedTopic, sortBy]);
  useEffect(() => {
    setArticles([]); setNextCursor(null);
    void loadArticles();
    return () => { requestId.current++; loadLock.current = false; };
  }, [loadArticles]);

'''+s[b:]
s=s.replace('getReadArticles(user.uid).then(setReadArticles);', "getReadArticles(user.uid).then(setReadArticles).catch(() => setReadArticles([]));\n    } else {\n      setReadArticles([]);")
s=s.replace('  const handleGenerate = async () => {', '  const handleGenerate = async () => {\n    if (generating) return;')
s=s.replace('      try {\n        // Firestore 아티클 저장', "      if (!user) {\n        sessionStorage.setItem('koreading_guest_article', JSON.stringify({ ...data, id: 'guest' }));\n        setShowGenModal(false); router.push('/read/guest'); return;\n      }\n      try {\n        // Firestore 아티클 저장")
s=re.sub(r"'ℹ️ Firebase Database 권한 설정.*?',\n          '데이터베이스 권한 오류'", "'글을 도서관에 저장하지 못했습니다. 생성된 글은 이 탭의 임시 읽기 페이지에서 읽을 수 있습니다.',\n          '저장 실패'", s, flags=re.S)
s=s.replace('이제 일일 20회 제한 없이 무제한으로 사용하실 수 있습니다.', '개인 제공사 할당량과 서비스 사용 한도가 적용됩니다.')
s=s.replace('즉시 대기 시간 없이 무제한으로 학습 자료를 평생 무료 생성하고 즐기실 수 있습니다!', '개인 제공사 할당량을 사용할 수 있습니다. 서비스 한도와 제공사 요금은 계속 적용됩니다.')
s=s.replace('무료 쿼터 초과 에러(429)를 우회하여 대기 시간 없이 평생 무제한으로 텍스트를 생성하시려면, 본인의 개인 Gemini API Key를 등록해 주세요. 입력된 키는 본인의 브라우저 로컬 저장소(localStorage)에만 안전하게 보관됩니다.', '개인 Gemini API Key를 등록하면 해당 키로 Gemini를 호출합니다. 키는 이 브라우저에 저장되며 요청 시 서버와 Google에 전달됩니다. 제공사 요금·할당량과 서비스 사용 한도가 적용됩니다.')
s=s.replace('{article.summary}', '{articleSummary(article, currentLang)}')
s=s.replace("      {/* 맞춤형 아티클 생성 설정 팝업 모달 */}", '''      {listError && <div role="alert"><p>{listError}</p><button onClick={() => loadArticles(nextCursor || undefined)}>Retry</button></div>}
      {nextCursor && <button className="btn btn-secondary" disabled={loadingArticles} onClick={() => loadArticles(nextCursor)}>{loadingArticles ? 'Loading…' : 'Load more / 더 보기'}</button>}
      {/* 맞춤형 아티클 생성 설정 팝업 모달 */}''')
write(p,s)
p='src/app/sitemap.ts'; s=read(p).replace("import { getAllArticles } from '@/lib/db';", "import { publicArticleIndex } from '@/lib/server/publicArticles';\nexport const revalidate = 3600;").replace('await getAllArticles()', 'await publicArticleIndex()'); write(p,s)
p='src/app/api/cron/system-audit/route.ts'; s=read(p).replace("import { getAllArticles, Article } from '@/lib/db';", "import type { Article } from '@/lib/db';\nimport { publicArticleIndex } from '@/lib/server/publicArticles';").replace('await getAllArticles()', 'await publicArticleIndex(true)'); write(p,s)
p='src/app/layout.tsx'; s=read(p); a=s.index('  alternates: {'); b=s.index('\n  // ── Open Graph',a); s=s[:a]+s[b:]; write(p,s)
for page in ['library','test','privacy','terms','about','login','profile','vocabulary','read/guest']:
    private=page in ['login','profile','vocabulary','read/guest']
    write(f'src/app/{page}/layout.tsx', f'''import type {{ Metadata }} from 'next';
export const metadata: Metadata = {{ alternates: {{ canonical: 'https://koreading.vercel.app/{page}' }}, {"robots: { index: false, follow: true }," if private else ""} }};
export default function Layout({{ children }}: {{ children: React.ReactNode }}) {{ return children; }}
''')
p='src/app/page.tsx'; s=read(p).replace('Find your exact level from A1 to C2 with an AI-generated reading test.', 'Find a suggested starting level with an AI-generated reading practice test.').replace('AI가 생성한 읽기 테스트로 A1부터 C2까지 정확한 레벨을 파악해요.', 'AI 읽기 연습 문제로 시작 난이도를 추천받아요. 공인 평가가 아닙니다.'); write(p,s)
p='src/components/ArticleIllustration.tsx'; s=read(p).replace('useState }', 'useEffect, useState }'); s=s.replace('  // 로드 실패 시', '  useEffect(() => { setLoaded(false); setHasError(false); }, [src]);\n\n  // 로드 실패 시'); write(p,s)
# Firestore composite indexes for all list filter/sort combinations.
indexes=[]
for filters in [[],['level'],['topicCategory'],['level','topicCategory']]:
    for rating in [False,True]:
        fields=[{'fieldPath':f,'order':'ASCENDING'} for f in filters]
        fields+=([{'fieldPath':'averageRating','order':'DESCENDING'}] if rating else [])
        fields += [{'fieldPath':'createdAt','order':'DESCENDING'},{'fieldPath':'__name__','order':'DESCENDING'}]
        if len(fields)>2: indexes.append({'collectionGroup':'articles','queryScope':'COLLECTION','fields':fields})
write('firestore.indexes.json', json.dumps({'indexes':indexes,'fieldOverrides':[{'collectionGroup':'reviews','fieldPath':'userId','indexes':[{'order':'ASCENDING','queryScope':'COLLECTION_GROUP'},{'order':'ASCENDING','queryScope':'COLLECTION'},{'order':'DESCENDING','queryScope':'COLLECTION'}]},{'collectionGroup':'aiUsage','fieldPath':'expiresAt','ttl':True,'indexes':[]}]},indent=2)+'\n')
write('firebase.json', json.dumps({'firestore':{'rules':'firestore.rules','indexes':'firestore.indexes.json'},'emulators':{'auth':{'port':9099},'firestore':{'port':8080},'ui':{'enabled':False}}},indent=2)+'\n')
