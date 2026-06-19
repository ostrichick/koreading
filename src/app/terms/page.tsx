'use client';

/**
 * @file page.tsx (terms)
 * @description Koreading 서비스 이용약관 페이지입니다.
 * 사이트의 신뢰성을 높이고 Google AdSense 심사 시 법적 준비가 된 사이트임을 증명합니다.
 */

export default function TermsPage() {
  const lastUpdated = '2026년 6월 7일';
  const operatorName = 'Koreading';
  const contactEmail = 'asulchoi@gmail.com';
  const serviceName = 'Koreading';
  const serviceUrl = 'https://koreading.vercel.app';

  return (
    <div style={{ minHeight: '100vh', padding: '60px 24px' }}>
      <div className="container" style={{ maxWidth: '760px' }}>
        {/* 페이지 헤더 */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '12px' }}>📋 이용약관</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Terms of Service · 최종 수정일: {lastUpdated}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* 1. 서비스 소개 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>제1조 (서비스 소개 및 목적)</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: '0.875rem' }}>
              본 약관은 <strong style={{ color: 'var(--text-primary)' }}>{operatorName}</strong>이 운영하는 <strong style={{ color: 'var(--text-primary)' }}>{serviceName}</strong>(<a href={serviceUrl} style={{ color: 'var(--accent-primary)' }}>{serviceUrl}</a>, 이하 &quot;서비스&quot;)의 이용 조건 및 절차, 운영자와 사용자의 권리·의무 및 책임 사항을 규정하는 것을 목적으로 합니다.
            </p>
          </section>

          {/* 2. 서비스 내용 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>제2조 (서비스 내용)</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: '0.875rem', marginBottom: '12px' }}>
              {serviceName}은 인공지능(AI) 기술을 활용한 한국어 독해 학습 플랫폼으로, 다음 서비스를 제공합니다.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                'CEFR 기반 한국어 레벨 진단 테스트',
                'AI 생성 맞춤형 한국어 독해 텍스트 제공',
                '단어 클릭 즉시 사전 (발음·번역·예문 제공)',
                '개인 단어장 저장 및 관리',
                '학습 진도(읽음 기록) 관리',
                '기타 운영자가 정하는 부가 서비스',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>•</span>{item}
                </div>
              ))}
            </div>
          </section>

          {/* 3. 가입 및 계정 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>제3조 (회원 가입 및 계정 관리)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <p>① 서비스는 Google 소셜 로그인을 통해 가입할 수 있으며, 로그인 없이도 기본 기능을 이용할 수 있습니다.</p>
              <p>② 사용자는 자신의 계정 정보를 정확하고 최신 상태로 유지할 책임이 있습니다.</p>
              <p>③ 계정의 비밀번호 관리는 Google 계정 보안에 준하며, 제3자에게 양도할 수 없습니다.</p>
              <p>④ 사용자는 언제든지 서비스 내 &quot;계정 설정 → 계정 삭제&quot;를 통해 회원 탈퇴를 요청할 수 있습니다.</p>
            </div>
          </section>

          {/* 4. 이용 제한 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>제4조 (금지 행위 및 이용 제한)</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: '0.875rem', marginBottom: '12px' }}>사용자는 다음 행위를 해서는 안 됩니다.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                '서비스를 통해 생성된 콘텐츠를 허가 없이 상업적으로 이용하거나 재배포',
                '서비스의 정상적인 운영을 방해하거나 서버에 과도한 부하를 주는 행위',
                '타인의 계정을 무단으로 사용하거나 도용하는 행위',
                '허위 정보를 입력하거나 타인을 사칭하는 행위',
                '관련 법령에 위반되는 행위',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <span style={{ color: '#ef4444', flexShrink: 0, fontWeight: 700 }}>✕</span>{item}
                </div>
              ))}
            </div>
          </section>

          {/* 5. AI 생성 콘텐츠 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>제5조 (AI 생성 콘텐츠 관련 안내)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <p>① 서비스의 모든 학습 텍스트는 인공지능(Google Gemini AI, Groq LPU)에 의해 자동 생성됩니다.</p>
              <p>② AI 생성 콘텐츠는 학습 목적으로만 제공되며, 운영자는 콘텐츠의 완전한 정확성을 보장하지 않습니다.</p>
              <p>③ 사실 관계가 중요한 사안에 대해서는 반드시 공식 출처를 통해 확인하시기 바랍니다.</p>
            </div>
          </section>

          {/* 6. 광고 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>제6조 (광고)</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.9 }}>
              <p>서비스는 Google AdSense 등 제3자 광고 서비스를 통해 광고를 게재할 수 있습니다. 광고 내용은 서비스 운영자가 아닌 광고주의 책임에 귀속되며, 운영자는 광고 내용의 정확성에 대해 보증하지 않습니다.</p>
            </div>
          </section>

          {/* 7. 서비스 변경 및 중단 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>제7조 (서비스 변경 및 중단)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <p>① 운영자는 서비스의 내용, 기능을 변경하거나 서비스를 종료할 수 있습니다.</p>
              <p>② 서비스 변경 또는 중단의 경우, 가능한 한 사전에 사용자에게 공지합니다.</p>
              <p>③ 운영자는 서비스 변경 또는 중단으로 인한 손해에 대해 책임을 부담하지 않습니다. 단, 운영자의 고의 또는 중과실에 의한 경우는 예외로 합니다.</p>
            </div>
          </section>

          {/* 8. 면책 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>제8조 (책임 제한 및 면책)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <p>① 운영자는 천재지변, 전쟁, 기간통신사업자의 서비스 중단 등 불가항력적 사유로 인한 서비스 장애에 대해 책임을 지지 않습니다.</p>
              <p>② 운영자는 사용자의 귀책 사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</p>
              <p>③ 서비스는 &quot;있는 그대로(AS-IS)&quot; 제공되며, 특정 목적에의 적합성에 대한 묵시적 보증을 포함하여 어떠한 종류의 보증도 제공하지 않습니다.</p>
            </div>
          </section>

          {/* 9. 준거법 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>제9조 (준거법 및 관할법원)</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: '0.875rem' }}>
              본 약관의 해석 및 분쟁 해결은 대한민국 법률에 따르며, 분쟁이 발생할 경우 관할 법원은 서울중앙지방법원으로 합니다.
            </p>
          </section>

          {/* 문의 */}
          <section className="card" style={{ padding: '28px', borderColor: 'rgba(99,102,241,0.3)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>문의</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.9 }}>
              <p><strong style={{ color: 'var(--text-primary)' }}>운영자:</strong> {operatorName}</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>이메일:</strong>{' '}
                <a href={`mailto:${contactEmail}`} style={{ color: 'var(--accent-primary)' }}>{contactEmail}</a>
              </p>
            </div>
          </section>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
            이 이용약관은 {lastUpdated}부터 적용됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
