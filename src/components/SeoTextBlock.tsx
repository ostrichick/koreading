/**
 * @file SeoTextBlock.tsx
 * @description 서버 컴포넌트로 렌더링되어 구글 봇이 JS 실행 없이도 읽을 수 있는 SEO용 영문 텍스트 블록입니다.
 * 홈페이지에서 숨겨진 형태로 삽입되어 구글이 영어 스니펫을 추출할 수 있게 합니다.
 * @why 홈페이지(page.tsx)가 'use client'이어서 구글 봇이 JS 렌더링 전 텍스트를 읽기 어렵습니다.
 *      이 서버 컴포넌트를 layout에서 삽입하여 구글이 항상 영어 설명을 볼 수 있게 합니다.
 */

export default function SeoTextBlock() {
  return (
    <div
      aria-hidden="false"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {/* 이 텍스트는 구글 봇 크롤링용입니다. 화면에는 보이지 않습니다. */}
      <h1>Koreading — Free AI-Powered Korean Reading Practice</h1>
      <p>
        Koreading is a free AI-powered Korean reading platform for language learners of all levels.
        Practice reading authentic Korean texts matched to your CEFR level from A1 (beginner) to C2 (mastery).
        Click any word for an instant dictionary lookup with definition, pronunciation, and example sentences.
        Build your Korean vocabulary with a personal notebook. Track your reading progress.
        No subscription required — completely free to get started.
      </p>
      <p>
        Whether you are a complete beginner learning to read Korean for the first time, or an advanced learner
        preparing for TOPIK, Koreading adapts to your level. Topics include Korean daily life, culture,
        history, food, K-content (K-drama, K-pop), fairy tales, travel, and current events.
      </p>
      <p>
        Key features: AI-generated Korean reading texts, instant word lookup dictionary, vocabulary notebook,
        CEFR level test, reading progress tracker. Supports English, Spanish, Japanese, and Chinese translations.
      </p>
      <p lang="es">
        Koreading es una plataforma gratuita de lectura en coreano con inteligencia artificial.
        Practica la lectura en coreano con textos adaptados a tu nivel, desde principiante hasta avanzado.
        Haz clic en cualquier palabra para obtener su definición y traducción al instante.
      </p>
      <p lang="ja">
        Koreading（コリーディング）は、AIを活用した無料の韓国語読解学習プラットフォームです。
        自分のレベル（A1〜C2）に合った韓国語テキストを読み、わからない単語をすぐに辞書で確認できます。
      </p>
    </div>
  );
}
