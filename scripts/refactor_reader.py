from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
def read(p): return (root/p).read_text(encoding='utf-8')
def write(p,s):
    path=root/p; path.parent.mkdir(parents=True,exist_ok=True); path.write_text(s,encoding='utf-8')

# Keep constants safe for both server and browser modules.
p='src/lib/gemini.ts'; s=read(p); a=s.index('// CEFR('); b=s.index('/**',a)
constants=s[a:b]; write('src/lib/contentConfig.ts', constants)
s=s[:a]+"export * from './contentConfig';\nimport type { CEFRLevel, NativeLanguage } from './contentConfig';\n\n"+s[b:]; write(p,s)
p='src/app/api/ai/route.ts'; s=read(p).replace("import { TOPICS } from '@/lib/gemini';", "import { TOPICS } from '@/lib/contentConfig';")
s=s.replace('systemInstruction });', "systemInstruction }, { timeout: 25000 });").replace('}, { timeout: 20000 });','});').replace('}, { timeout: 25000 });\n            resultText', '});\n            resultText')
# Only remove per-call request options (model construction retains them).
s=s.replace('}, { timeout: 25000 });\n            validateArticleQuality', '});\n            validateArticleQuality')
s=s.replace('const { type } = body;', 'const type = body.action === \'lookupWord\' ? body.type : \'all\';')
write(p,s)

for p in ['src/app/read/[id]/page.tsx','src/app/read/guest/page.tsx']:
    s=read(p)
    s=s.replace("import { lookupWordAll, TOPICS }", "import { TOPICS }")
    s=s.replace('useCallback, ', '').replace('use, ', '').replace(', Fragment', '')
    s=s.replace("import { tokenizeKorean, isKoreanWord } from '@/lib/utils';", "import { useWordLookup } from '@/hooks/useWordLookup';\nimport ReaderBody from '@/components/reader/ReaderBody';\nimport TutorPanel, { type TutorSelection } from '@/components/reader/TutorPanel';\nimport { articleSummary } from '@/lib/learning';")
    a=s.index('interface WordData'); b=s.index('// 다국어',a); s=s[:a]+s[b:]
    s=re.sub(r'  const \[wordData, setWordData\].*?\n', '', s)
    s=re.sub(r'  const \[loadingWord, setLoadingWord\].*?\n', '', s)
    s=re.sub(r'  const \[loadingAdvanced, setLoadingAdvanced\].*?\n', '', s)
    s=re.sub(r'  const wordCacheRef.*?\n', '', s)
    a=s.index('  const fetchWordData ='); b=s.index('\n  /**',a)
    s=s[:a]+"  const { wordData, loadingWord, loadingAdvanced, lookupError, fetchWordData, clearWord } = useWordLookup(profile?.nativeLanguage || getGuestLang());\n"+s[b:]
    s=s.replace('setWordData(null);', 'clearWord();').replace('    setLoadingWord(false);\n','').replace('    setLoadingAdvanced(false);\n','')
    a=s.index('  // 💬 AI 튜터 코칭'); b=s.index('  // 🎙️',a)
    s=s[:a]+"  const [tutorSelection, setTutorSelection] = useState<TutorSelection | null>(null);\n  const handleOpenTutor = (index: number, text: string) => setTutorSelection({ index, text });\n"+s[b:]
    a=s.index('      {/* 💬 AI 튜터 1:1'); b=s.rindex('    </div>\n  );')
    s=s[:a]+"      <TutorPanel selected={tutorSelection} onClose={() => setTutorSelection(null)} language={profile?.nativeLanguage || getGuestLang()} level={profile?.level || article?.level || 'A1'} labels={t} />\n"+s[b:]
    a=s.index('        <div className="card" style={{ padding: \'36px\', marginBottom: \'32px\' }}>\n          {paragraphs.map')
    b=s.index('\n        </div>',s.index('          })}',a))+len('\n        </div>')
    s=s[:a]+"""        {lookupError && <p role="alert">{lookupError}</p>}
        <ReaderBody paragraphs={paragraphs} article={article} fontSize={fontSize} lineHeight={lineHeight} savedWords={savedWords} recordingParaIdx={recordingParaIdx} paraScores={paraScores} onWordClick={handleWordClick} onWordEnter={handleWordMouseEnter} onWordLeave={handleWordMouseLeave} onSpeak={speakText} onTutor={handleOpenTutor} onMic={handleMicClick} />"""+s[b:]
    s=s.replace('{article.summary}', "{articleSummary(article, profile?.nativeLanguage || getGuestLang())}")
    if '[id]' in p:
        s=s.replace("export default function ReadPage({ params }: { params: Promise<{ id: string }> }) {\n  const { id } = use(params);", "export default function ArticleReader({ initialArticle }: { initialArticle: Article }) {\n  const id = initialArticle.id;")
        s=s.replace('useState<Article | null>(null)', 'useState<Article | null>(initialArticle)').replace('const [loading, setLoading] = useState(true)', 'const [loading, setLoading] = useState(false)')
        s=s.replace('const a = await getArticleById(id);', 'const a = initialArticle;')
        s=s.replace('    load();', "    load().catch(() => { setLoading(false); });")
        s=s.replace('  }, [id, user, router]);', '  }, [id, user, router, initialArticle]);')
        s=s.replace('    if (rating === 0) {', "    if (submittingReview) return;\n    if (!user) { router.push('/login'); return; }\n    if (rating === 0) {")
        write('src/components/reader/ArticleReader.tsx',s)
    else: write(p,s)
