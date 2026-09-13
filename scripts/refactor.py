from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
def read(p): return (root/p).read_text(encoding='utf-8')
def write(p,s):
    path=root/p; path.parent.mkdir(parents=True,exist_ok=True); path.write_text(s,encoding='utf-8')

for name in ['check-models','monthly-model-audit','system-audit']:
    p=f'src/app/api/cron/{name}/route.ts'; s=read(p)
    s="import { isAuthorizedCron } from '@/lib/cronAuth';\n"+s
    if name=='check-models':
        a=s.index('  // Vercel Cron 요청'); b=s.index('  const geminiKey',a); s=s[:a]+s[b:]
    elif name=='system-audit':
        a=s.index('  // 1. 인증 가드'); b=s.index('  // 기준 URL',a); s=s[:a]+s[b:]
    s=s.replace('export async function GET(req: NextRequest) {', "export async function GET(req: NextRequest) {\n  if (!isAuthorizedCron(req.headers, process.env.CRON_SECRET)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });")
    if name=='monthly-model-audit':
        s=s.replace('let parsedOk = false;', "let parsedOk = false;\n      let koreanText = ''; ")
        s=s.replace('JSON.parse(text);', "const parsed = JSON.parse(text);\n        if (!['title', 'content', 'korean'].every(k => typeof parsed[k] === 'string' && parsed[k].trim())) throw new Error('Invalid benchmark');\n        koreanText = [parsed.title, parsed.content, parsed.korean].join(' ');")
        s=s.replace('text.match(/[', 'koreanText.match(/[').replace("r.status === 'SUCCESS'", "r.status === 'SUCCESS' && r.jsonValid && r.koreanPurityScore > 0")
    if name=='system-audit':
        s=s.replace('totalIndexedUrls', 'totalListedUrls').replace('정적 페이지만 색인됨','사이트맵에 정적 페이지만 포함됨')
        s=s.replace('const quotaReport = {', "const quotaReport = {\n    isEstimate: true,\n    note: 'Based on article count only; this is not live usage, billing, or search index data.',")
    write(p,s)

p='src/lib/db.ts'; s=read(p)
s="import { serverMutation } from './authFetch';\nimport { auth } from './firebase';\n"+s
s=s.replace('  runTransaction,\n','')
s=s.replace('  summary: string;', '  summaryLanguage?: NativeLanguage;\n  summaries?: Partial<Record<NativeLanguage, string>>;\n  summary: string;')
s=s.replace('  id?: string;', '  userId?: string;\n  id?: string;')
a=s.index("  const ref = collection(db, 'articles');",s.index('export async function saveArticle')); b=s.index('\n}',a)
s=s[:a]+"  return (await serverMutation('/api/articles', article)).id;"+s[b:]
a=s.index('  const reviewsRef',s.index('export async function saveReview')); b=s.index('\n}',a)
s=s[:a]+"  await serverMutation('/api/reviews', { articleId, rating: review.rating, pros: review.pros, cons: review.cons });"+s[b:]
a=s.index('  const uid = user.uid;',s.index('export async function deleteUserAccount')); b=s.index('\n}',a)
s=s[:a]+"  await serverMutation('/api/account/delete', {});\n  await auth.signOut();"+s[b:]
s=s.replace('export async function deleteUserAccount(user: any)', 'export async function deleteUserAccount(_user: unknown)')
write(p,s)

p='firestore.rules'; s=read(p)
s=s.replace('return request.auth != null;', "return request.auth != null && !exists(/databases/$(database)/documents/accountDeletions/$(request.auth.uid));")
s=s.replace('isAuthenticated() && request.auth.uid == uid','isAuthenticated() && request.auth.uid == uid')
s=s.replace('allow create: if isAuthenticated();','allow create: if false;')
a=s.index('        allow update:'); b=s.index('\n      }',a)
s=s[:a]+"        allow update, delete: if false; // authenticated server transaction only"+s[b:]
write(p,s)

p='src/lib/gemini.ts'; s=read(p)
s="import { authHeaders } from './authFetch';\n"+s
s=s.replace("async function callAI(body: object)","export async function callAI(body: object)")
s=s.replace("headers: { 'Content-Type': 'application/json' },",'headers: await authHeaders(),')
s=s.replace('generatePlacementTest()', "generatePlacementTest(nativeLang: NativeLanguage = 'en')").replace("{ action: 'generateTest' }", "{ action: 'generateTest', nativeLang }")
write(p,s)

p='src/app/api/ai/route.ts'; s=read(p)
s=s.replace("export const runtime = 'edge';", "export const runtime = 'nodejs';\nexport const maxDuration = 180;")
s="import { createHmac } from 'node:crypto';\nimport { aiRequestSchema, articleSchema, basicWordSchema, advancedWordSchema, placementSchema, parseModelJson } from '@/lib/schemas';\nimport { validateArticleQuality } from '@/lib/articleQuality';\nimport { reserveAiQuota } from '@/lib/server/aiQuota';\nimport { apiError, HttpError, readJson } from '@/lib/server/http';\n"+s
a=s.index('// IP 기반'); b=s.index('export async function POST',a); s=s[:a]+s[b:]
a=s.index('    // ── 보안 체크 0'); b=s.index('    // 사용자가 직접 입력한',a)
s=s[:a]+"""    const checked = aiRequestSchema.safeParse(await readJson(req));
    if (!checked.success) throw new HttpError(400, 'Invalid AI request');
    const body = checked.data;
    await reserveAiQuota(req, body.action);
    // Fields have already been validated by the action-specific schema.
    const { action, level, topic, nativeLang, word, sentence, customApiKey, paragraph, userMessage, chatHistory, customKeyword, genre, recentTitles } = body as any;
"""+s[b:]
s=s.replace('if (!activeApiKey) {','if (!activeApiKey && !process.env.GROQ_API_KEY) {')
s=s.replace('if (process.env.GROQ_API_KEY) {','if (process.env.GROQ_API_KEY && !customApiKey) {')
s=s.replace("const genAI = new GoogleGenerativeAI(activeApiKey);", "const genAI = new GoogleGenerativeAI(activeApiKey);\n    const validateResult = (value: string, variant?: 'basic' | 'advanced') => {\n      if (action === 'tutorChat') { if (!value.trim() || value.length > 10000) throw new Error('Invalid tutor response'); return; }\n      const parsed = parseModelJson(value);\n      if (action === 'generateTest') placementSchema.parse(parsed);\n      if (action === 'lookupWord') (variant === 'advanced' ? advancedWordSchema : basicWordSchema).parse(parsed);\n    };")
s=s.replace("responseMimeType?: string): Promise", "responseMimeType?: string, variant?: 'basic' | 'advanced'): Promise")
s=s.replace("return { text: data.choices[0].message.content, modelUsed:", "validateResult(data.choices[0].message.content, variant);\n            return { text: data.choices[0].message.content, modelUsed:")
s=s.replace('generationConfig: config\n          });', 'generationConfig: { ...config, maxOutputTokens: 6000 }\n          }, { timeout: 20000 });\n          validateResult(result.response.text(), variant);')
s=s.replace('generationConfig: genConfig\n            });','generationConfig: { ...genConfig, maxOutputTokens: 7000 }\n            }, { timeout: 25000 });')
s=s.replace('resultText = data.choices[0].message.content;', "validateArticleQuality(articleSchema.parse(parseModelJson(data.choices[0].message.content)), level, topic);\n              resultText = data.choices[0].message.content;")
s=s.replace('resultText = r.response.text();', "validateArticleQuality(articleSchema.parse(parseModelJson(r.response.text())), level, topic);\n            resultText = r.response.text();")
s=s.replace('const parsed = JSON.parse(resultText);', 'const parsed = articleSchema.parse(parseModelJson(resultText));')
a=s.index('      const levelConfig:'); b=s.index('      const topicLabel',a); s=s[:a]+s[b:]
s=s.replace('  "summary": "${langNote}로 작성된 한 문장의 본문 요약",','  "summary": "${langNote}로 작성된 한 문장의 본문 요약",\n  "summaries": {"en":"English summary", "es":"Resumen en español", "ja":"日本語の要約", "zh":"中文摘要"},')
s=s.replace('2, // 텍스트 난이도와 길이에 따라 예상 소요 시간(분)을 정수(예: 1, 2, 3, 4)로 동적 예측','2,')
a=s.index('          return NextResponse.json({\n            ...parsed,'); b=s.index('\n        } catch',a)
s=s[:a]+"""          const article = articleSchema.parse({ ...parsed, summaryLanguage: nativeLang, imageUrls, imagePrompts: [prompt1, prompt2], generatorModel: modelUsed });
          const expires = Date.now() + 24 * 60 * 60 * 1000;
          const signature = createHmac('sha256', process.env.AI_GUEST_SECRET!).update(JSON.stringify(article) + expires).digest('hex');
          return NextResponse.json({ ...article, _expires: expires, _signature: signature, _logs: logs });"""+s[b:]
s=s.replace("generateWithFallback(advancedPrompt, 'application/json')", "generateWithFallback(advancedPrompt, 'application/json', 'advanced')")
s=s.replace('JSON.parse(', 'parseModelJson(') # common fenced JSON handling
s=s.replace('5개 레벨의 한국어 독해', '6개 레벨의 한국어 독해').replace('질문("question")과 보기("options")는 영어로 작성해 주세요.', '질문("question")과 보기("options")는 ${{ en: "English", es: "Spanish", ja: "Japanese", zh: "Chinese" }[nativeLang as NativeLanguage]}로 작성해 주세요.')
s=s.replace('영어 질문', '선택 언어 질문').replace('A1, A2, B1, B2, C1 레벨을 모두 포함해 주세요.', 'A1, A2, B1, B2, C1, C2 레벨을 이 순서대로 모두 포함하고 레벨마다 정확히 두 문제를 제공하세요.')
a=s.rindex('    const message = err?.message'); s=s[:a]+"    return apiError(err);\n  }\n}\n"
# Avoid provider error messages in client logs (may contain request URLs).
s=re.sub(r"logs.push\(`⚠️ \$\{name\} 오류: .*?\);", "logs.push(`⚠️ ${name} 응답 실패`);", s)
s=s.replace('${errText}', '응답 오류').replace("${(e?.message || '').substring(0, 80)}", '요청 실패')
write(p,s)

p='src/lib/koreanCurriculum.ts'; s=read(p).replace('SVO 구조','SOV 구조'); write(p,s)
p='src/app/test/page.tsx'; s=read(p)
s="import { recommendLevel } from '@/lib/learning';\n"+s
s=s.replace('generatePlacementTest()', 'generatePlacementTest(nativeLang)')
a=s.index('    const levels: Level[]',s.index('const calculateLevel')); b=s.index('\n  };',a)
s=s[:a]+'    return recommendLevel(allAnswers);'+s[b:]
s=s.replace('score < 0.5', 'score < 1').replace('50%', '100%')
s=s.replace('    setTestData(data);', "    setCurrentLevelIdx(0); setCurrentQIdx(0); setAnswers({}); setSelectedAnswer(null);\n      setTestData(data);")
a=s.index('    // 게스트용 로컬',s.index('const saveAndContinue')); b=s.index('\n  };',a)
s=s[:a]+"""    try {
      if (user) {
        await createOrUpdateUser(user.uid, { level: resultLevel, nativeLanguage: nativeLang });
        await refreshProfile();
      }
      setGuestLevel(resultLevel); setGuestLang(nativeLang);
      router.push('/library');
    } catch { triggerAlert('설정을 저장하지 못했습니다. 다시 시도해 주세요.', '저장 실패', 'error'); }
    finally { setSaving(false); }"""+s[b:]
s=s.replace("  const totalLevels = testData?.levels.length || 5;", "  const totalLevels = testData?.levels.length || 6;")
write(p,s)
