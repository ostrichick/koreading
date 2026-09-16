/**
 * @file koreanCurriculum.ts
 * @description 국립국어원 한국어 표준 교육과정 및 국제 통용 한국어 표준 교육과정(CEFR)에 기반한
 *              외국인 학습자 맞춤형 교육 커리큘럼 엔진입니다.
 * 
 * [핵심 교육학적 원리]
 * 1. 크라센(Stephen Krashen)의 i+1 입력 가설(Comprehensible Input):
 *    - 학습자의 현재 레벨에서 90%는 직관적으로 이해할 수 있는 친숙한 어휘와 문장으로 구성하고,
 *      10%는 이번 글을 통해 반드시 습득해야 할 신규 목표 문법과 어휘로 정밀 제어합니다.
 * 2. 어휘 재활용(Vocabulary Recycling):
 *    - 선정된 5개의 핵심 학습 어휘(keyVocabulary)를 본문 속에서 최소 2~3회 자연스럽게 반복 노출하여,
 *      글을 다 읽었을 때 단어가 저절로 암기되는 언어 습득 효과를 창출합니다.
 * 3. 목표 문법(Target Grammar Patterns) 필수 내재화:
 *    - 각 레벨별 필수 문법 공식을 본문에 2~3개 이상 반드시 녹여내어 문법 패턴 학습을 유도합니다.
 * 4. 시각 보조자료(Visual Aid) 1:1 매핑:
 *    - 삽화를 단순한 배경 그림이 아닌, 본문의 '상황도(커버)'와 '핵심 어휘 사물도(본문 중간)'로 명확히 디렉팅합니다.
 */

import { CEFRLevel } from './gemini';

export interface LevelCurriculum {
  name: string;
  nameEn: string;
  targetAudience: string;
  targetGrammar: string[];
  sentenceConstraint: string;
  lengthConstraint: string;
  situationalFocus: string;
}

export const KOREAN_CURRICULUM: Record<CEFRLevel, LevelCurriculum> = {
  A1: {
    name: '완전 초급 1',
    nameEn: 'Complete Beginner (A1)',
    targetAudience: '한글 자모를 갓 떼고 기본 인사말과 단문만 이해할 수 있는 학습자',
    targetGrammar: [
      '-이/가, -을/를, -은/는 (기본 주격/목적격/보조사)',
      '-아요/어요 (현재 시제 기본 비격식 해요체)',
      '-에 가요, -에 있어요/없어요 (장소 및 위치)',
      '-고 싶어요 (희망/소망 표현)',
      '-(으)세요 (정중한 권유/명령)',
    ],
    sentenceConstraint: '한 문장당 단어 4~6개의 매우 짧고 명료한 단문(SOV 구조). 복잡한 접속사 금지. 1개의 옹골찬 문단 또는 2개의 짧은 문단.',
    lengthConstraint: '약 350~450자 내외. 절대 불필요하게 길거나 복잡하지 않게 작성.',
    situationalFocus: '기본 인사, 자기소개, 식당에서 음식 주문하기, 물건 사기, 장소 묻기, 좋아하는 것 말하기 등 실생활 생존 한국어 상황.',
  },
  A2: {
    name: '초급 2',
    nameEn: 'Elementary (A2)',
    targetAudience: '기본 일상 표현을 구사하며 과거/미래 시제와 간단한 이유/조건을 표현하고 싶은 학습자',
    targetGrammar: [
      '-(으)러 가다/오다 (목적과 이동)',
      '-(으)면 (단순 조건문)',
      '-아/어서 (이유 및 시간 순서)',
      '-(으)ㄹ 수 있다/없다 (가능/불가능)',
      '-(으)ㄹ 거예요 (미래/계획)',
      '-아/어 보다 (경험 시도)',
    ],
    sentenceConstraint: '한 문장당 단어 6~9개로 구성된 연결 문장. 2~3개의 정돈된 문단. 과거/현재/미래 시제의 자연스러운 조화.',
    lengthConstraint: '약 550~700자 내외.',
    situationalFocus: '주말 계획, 한국 친구와의 약속, 교통수단(지하철/버스) 이용, 편의점/시장 쇼핑, 한국 음식 소개, 날씨와 계절 활동.',
  },
  B1: {
    name: '중급 1 (입문)',
    nameEn: 'Intermediate (B1)',
    targetAudience: '이제 막 초급(A2)을 마치고 중급에 처음 입문하여, 친숙한 일상 및 여행 주제에 대해 생각과 경험을 표현하고 싶은 학습자',
    targetGrammar: [
      '-(으)ㄴ 적이 있다/없다 (과거 경험)',
      '-기 때문에 (명확한 이유 설명)',
      '-(으)ㄹ 것 같다 (부드러운 추측과 의견)',
      '-는데 / -(으)ㄴ데 (배경 설명 및 대조)',
      '-(으)면서 (동시 동작)',
      '-기로 하다 (결정과 결심)',
    ],
    sentenceConstraint: '한 문장당 단어 7~10개의 명료한 문장. 한 문장에 연결어미는 최대 1~2개까지만 허용(-아서, -는데, -기 때문에 등). 3중 이상의 복잡한 관형사절이나 다중 복문 절대 금지. 2~3개의 정돈된 문단.',
    lengthConstraint: '약 480~620자 내외. 문장을 군더더기 없이 간결하고 읽기 쉽게 작성.',
    situationalFocus: '한국 여행 경험기, K-드라마/영화 감상, 취미 생활, 한국의 음식/카페 문화 체험, 일상적인 생각 나누기.',
  },
  B2: {
    name: '중급 2',
    nameEn: 'Upper Intermediate (B2)',
    targetAudience: '추상적이거나 사회적인 주제에 대해 의견을 제시하고 논리적인 글을 독해할 수 있는 학습자',
    targetGrammar: [
      '-아/어 두다/놓다 (행동의 결과 유지)',
      '-다고 하다 / -자고 하다 (간접화법 표현)',
      '-(으)ㄴ/는 반면에 (본격적인 대조)',
      '-도록 하다 (권고 및 목적)',
      '-(으)ㄹ 뿐만 아니라 (추가 정보 제시)',
      '-(으)ㄹ 수밖에 없다 (불가피성 표현)',
    ],
    sentenceConstraint: '복합 문장과 문단 간 유기적 연결. 3~4개의 체계적 문단. 관용적 표현과 구어/문어의 자연스러운 배합.',
    lengthConstraint: '약 1100~1350자 내외.',
    situationalFocus: '한국의 최신 트렌드(팝업스토어, 친환경 실천), 직장 내 에티켓, 현대인들의 건강 관리, 전통과 현대의 조화, 쉬운 시사 칼럼.',
  },
  C1: {
    name: '고급 1',
    nameEn: 'Advanced (C1)',
    targetAudience: '신문 기사, 전문 방송, 문학 작품 등 원어민 수준의 고급 한국어 담화를 이해하고자 하는 학습자',
    targetGrammar: [
      'N(이)야말로 (강조 표지)',
      'V-(으)ㄹ 겸 (겸사겸사 복합 목적)',
      'V-고자 (격식적 의도)',
      'V-(으)ㄹ 바에야 (차라리 선택)',
      '다양한 관용구(속담, 사자성어, 비유적 연어)',
    ],
    sentenceConstraint: '품격 있는 어휘 선택, 복잡한 인과관계 및 대조 구문, 4개의 깊이 있는 문단 구성.',
    lengthConstraint: '약 1400~1650자 내외.',
    situationalFocus: '한국 역사적 인물의 리더십, 한국 사회의 세대 담론, 전통 예술의 가치, 문학적 에세이, 심도 있는 문화 분석.',
  },
  C2: {
    name: '고급 2 (원어민 숙달)',
    nameEn: 'Mastery (C2)',
    targetAudience: '원어민 지식인 수준의 학술적, 비평적, 철학적 한국어 텍스트를 독해할 수 있는 최상위 학습자',
    targetGrammar: [
      '고급 담화 표지 및 학술적 논증 구문',
      '심층적인 비유 및 한국어 특유의 정서적 어휘',
      '정교한 수동/피동 및 사동 표현 체계',
    ],
    sentenceConstraint: '원어민 작가/언론인의 세련되고 유려한 문체. 완벽한 단락 논리와 풍부한 함의.',
    lengthConstraint: '약 1700~2000자 내외.',
    situationalFocus: '한국 철학과 미학, 세계화 속의 한국 문화 정체성, 언어와 사회의 상관관계, 인문학적 성찰.',
  },
};

/**
 * AI 프롬프트에 주입할 레벨별 교육학적 엄격 지침(Pedagogical Prompt Block)을 생성합니다.
 */
export function getPedagogicalInstruction(level: CEFRLevel, topicLabel: string): string {
  const c = KOREAN_CURRICULUM[level] || KOREAN_CURRICULUM.A2;
  const grammarList = c.targetGrammar.map(g => `   • ${g}`).join('\n');

  return `
[🎓 KFL(외국어로서의 한국어) 전문 교육과정 필수 준수 지침 (CEFR ${level} - ${c.name})]:
1. 대상 학습자: ${c.targetAudience}
2. 이번 텍스트의 필수 목표 문법 (아래 문법 패턴 중 최소 2~3개를 반드시 본문 문장에 자연스럽게 활용할 것):
${grammarList}

3. 🌟 스티븐 크라센(Stephen Krashen)의 i+1 어휘 상한선 (CRITICAL VOCABULARY CEILING):
   - 본문 전체 단어의 **85~90%**는 학습자가 이미 100% 알고 있는 **직전/기초 레벨의 필수 기본 어휘**(예: 가다, 오다, 보다, 먹다, 예쁘다, 춥다, 겨울, 하늘, 밤, 사진, 친구, 생각하다 등)로만 작성해야 합니다.
   - 학습자가 이번 글을 통해 새로 배우는 "+1"의 낯선 어휘는 **오직 아래 JSON의 "keyVocabulary" 5개 단어뿐**이어야 합니다.
   - ❌ 문학적/소설적/시적 고난도 수식어 절대 금지 (STRICT NEGATIVE CONSTRAINT):
     ('남몰래', '물들이다', '피워 둔', '모닥불', '빛의 파도', '장관', '매서운', '순식간에', '아른거리다', '경이로운', '마주하다', '눈을 뗄 수 없다', '어렴풋이' 등 소설이나 시에서나 쓰는 어려운 문학적 표현은 전면 금지합니다.)
   - ⭕ 누구나 아는 쉬운 일상적 표현으로 대체:
     ('매서운 추위' ➔ '정말 추운 날씨', '장관' ➔ '아주 멋진 풍경', '마주했다' ➔ '보게 되었다', '모닥불 같았다' ➔ '따뜻하게 느껴졌다')

4. 핵심 어휘 반복 각인 원칙 (Vocabulary Recycling - CRITICAL):
   - 아래 JSON의 "keyVocabulary"로 선정할 5개의 핵심 단어는, 본문 속에서 각각 **최소 2회 이상 자연스럽게 반복(Recycled)**되어야 합니다.
   - 단어가 한 번만 스치고 지나가면 학습자가 기억할 수 없습니다. 학습자가 글을 다 읽고 났을 때 이 5개 단어가 머릿속에 확실히 각인되도록 맥락 속에서 반복해서 사용하십시오.

5. 문장 호흡 및 구조 통제:
   - ${c.sentenceConstraint}
   - 지문 길이: ${c.lengthConstraint}
   - 상황 설정: ${c.situationalFocus}
   - 뜬구름 잡는 추상적 소설이나 난해한 문학적 묘사를 절대 금지합니다. 외국인 학습자가 "이 상황에서 이 표현을 쓰는구나!" 하고 실제 한국 생활과 언어에 바로 적용할 수 있는 구체적이고 생생한 교육 지문으로 작성하십시오.
`;
}

/**
 * 본문의 시각적 이해를 1:1로 돕는 교재형 일러스트 디렉팅 지침을 생성합니다.
 */
export function getVisualAidDirectingInstruction(): string {
  return `
[🖼️ 교육용 시각 보조자료(Visual Aid) 일러스트 디렉팅 지침 (CRITICAL)]:
생성할 2개의 영문 이미지 프롬프트("imagePrompts")는 예술적 판타지나 모호한 추상화가 아닌, **한국어 교재 삽화(Language Textbook Visual Aid)**처럼 본문의 내용을 100% 직관적으로 이해할 수 있도록 설계해야 합니다.

1. "imagePrompts[0]" -> [대표 상황도 (Situational Scene)]:
   - 역할: 글이 일어나는 전체적인 장소, 인물들의 구체적 행동, 전체 상황을 한눈에 보여주는 상황도.
   - 구성 공식: "[주인공/인물]이 [구체적인 한국 배경 장소]에서 [핵심 행동]을 하고 있는 구체적인 모습".
   - 화풍: "Clear modern Korean educational textbook illustration style, bright pleasant lighting, simple uncluttered background, clean vector lines, absolutely NO text, NO letters, NO words, no watermark".

2. "imagePrompts[1]" -> [핵심 어휘 사물도/동작도 (Key Vocabulary Focus)]:
   - 역할: 본문 핵심 어휘(keyVocabulary) 중 가장 중요한 1~2개 사물이나 핵심 동작을 클로즈업하여, 학습자가 그림을 보고 단어의 의미를 즉시 깨닫도록 돕는 도해.
   - 구성 공식: "A sharp close-up illustration focusing clearly on [핵심 단어 사물 또는 손동작], clearly demonstrating how it looks or is used".
   - 화풍: "Educational visual dictionary illustration style, close-up focal point on the object, vibrant colors, clear details, absolutely NO text, NO letters, NO words, no watermark".
`;
}
