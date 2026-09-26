'use client';

/**
 * @file page.tsx (privacy)
 * @description Koreading 서비스의 개인정보처리방침 페이지입니다.
 * Google AdSense 심사 통과를 위해 반드시 존재해야 하는 필수 법적 문서입니다.
 * Firebase Authentication 및 Google Analytics(향후 도입 시) 사용 사실을 명시합니다.
 */

export default function PrivacyPage() {
  const lastUpdated = '2026년 9월 24일';
  const operatorName = 'Koreading';
  const contactEmail = 'asulchoi@gmail.com';
  const serviceName = 'Koreading';
  const serviceUrl = 'https://koreading.vercel.app';

  return (
    <div style={{ minHeight: '100vh', padding: '60px 24px' }}>
      <div className="container" style={{ maxWidth: '760px' }}>
        {/* 페이지 헤더 */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '12px' }}>🔒 개인정보처리방침</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Privacy Policy · 최종 수정일: {lastUpdated}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* 1. 개요 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>1. 개요</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: '0.9rem' }}>
              {operatorName}(이하 &quot;운영자&quot;)이 운영하는 <strong>{serviceName}</strong>(<a href={serviceUrl} style={{ color: 'var(--accent-primary)' }}>{serviceUrl}</a>)는 사용자의 개인정보를 소중히 여기며, 「개인정보보호법」 및 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」에 따라 개인정보를 처리하고 있습니다. 본 방침은 운영자가 어떤 정보를 수집하고, 왜 수집하며, 어떻게 사용하는지를 설명합니다.
            </p>
          </section>

          {/* 2. 수집하는 정보 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>2. 수집하는 개인정보 항목</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>📌 Google 로그인(소셜 로그인) 이용 시</h3>
                <ul style={{ listStyle: 'none', paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['이름(Display Name)', '이메일 주소', '프로필 사진 URL', 'Google 제공 고유 사용자 ID(UID)'].map(item => (
                    <li key={item} style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>•</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>📌 서비스 이용 과정에서 자동 생성되는 정보</h3>
                <ul style={{ listStyle: 'none', paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['학습 레벨(CEFR 등급)', '모국어 설정값', '읽음 처리된 아티클 ID 목록', '저장한 단어 목록', '비공개 생성 글, 공개 리뷰(별점·의견·표시 이름), 비공개 리뷰 소유권 매핑', '서비스 요청 시 IP 주소 기반 이용 제한 정보 및 접속 로그'].map(item => (
                    <li key={item} style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>•</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>📌 비로그인(게스트) 이용 시</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>
                  비로그인 이용자는 회원 프로필과 개인 단어장을 생성하지 않습니다. 레벨·언어 설정은 브라우저 로컬 스토리지(localStorage), 임시 생성 글은 세션 스토리지(sessionStorage)에 저장됩니다. 다만 AI 요청 내용은 서비스 서버 및 설정된 AI 제공사로 전송되며, 이용 제한과 운영을 위한 IP 기반 정보·접속 로그가 처리될 수 있습니다.
                </p>
              </div>
            </div>
          </section>

          {/* 3. 이용 목적 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>3. 개인정보의 이용 목적</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                '회원 가입 및 로그인 처리, 본인 확인',
                '학습 레벨 설정 및 맞춤형 콘텐츠 제공 (자동 레벨 테스트는 현재 비활성)',
                '개인 단어장, 읽음 기록 등 학습 데이터 저장 및 관리',
                '서비스 운영 및 품질 개선',
                '불법·부정 이용 방지 및 보안 유지',
                '법령 상의 의무 준수',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>{item}
                </div>
              ))}
            </div>
          </section>

          {/* 4. 제3자 제공 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>4. 제3자 제공 및 외부 서비스 연동</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: '0.875rem', marginBottom: '16px' }}>
              수집한 개인정보는 원칙적으로 외부에 제공하지 않습니다. 단, 서비스 운영을 위해 아래의 신뢰할 수 있는 제3자 서비스가 이용됩니다.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { service: 'Google Firebase Authentication', purpose: '로그인 인증 처리', link: 'https://firebase.google.com/support/privacy' },
                { service: 'Google Cloud Firestore', purpose: '사용자 학습 데이터 저장', link: 'https://firebase.google.com/support/privacy' },
                { service: 'Google Gemini API', purpose: 'AI 기반 학습 텍스트 및 사전 콘텐츠 생성', link: 'https://ai.google.dev/gemini-api/terms' },
                { service: 'Groq Inc.', purpose: '설정된 경우 일부 AI 요청의 우선 처리 또는 글 생성 폴백', link: 'https://groq.com/privacy-policy/' },
                { service: 'Vercel Inc.', purpose: '서비스 웹 호스팅 및 배포', link: 'https://vercel.com/legal/privacy-policy' },
                { service: 'Google AdSense', purpose: '광고 게재 (수익화)', link: 'https://policies.google.com/privacy' },
              ].map(({ service, purpose, link }) => (
                <div key={service} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{service}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{purpose}</div>
                  <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>개인정보처리방침 보기 →</a>
                </div>
              ))}
            </div>
          </section>

          {/* 5. 보관 기간 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>5. 개인정보 보관 및 파기</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <p>수집된 개인정보는 서비스 이용 계약이 유지되는 기간 동안 보관됩니다.</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>회원 탈퇴 시:</strong> 최근 로그인 확인 후 삭제 절차를 시작합니다. 본인으로 확인되는 리뷰는 공개 문서 자체를 삭제하고 글의 평점·리뷰 수를 다시 계산합니다. 개인 단어장, 읽음 기록, 카테고리, 비공개 초안, 회원 프로필을 삭제한 뒤 Firebase 인증 계정 삭제를 시도합니다. 중간에 실패하면 계정 삭제가 완료되지 않을 수 있으며, 재로그인 후 재시도해야 할 수 있습니다.</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>탈퇴 후 남는 정보:</strong> 탈퇴 중 새 데이터 작성을 차단하기 위해 계정 UID와 삭제 시작 시각이 들어 있는 비공개 삭제 표식은 Firestore에 계속 보관됩니다. 과거 공개 글은 작성자 계정과 연결되어 있지 않아 자동으로 삭제되지 않을 수 있습니다. 이름만 있는 과거 리뷰는 소유자를 추측하여 삭제하지 않습니다. 서비스 접속 로그, 법령에 따른 보관 정보 및 브라우저에 남은 로컬 저장 데이터도 위 계정 삭제 절차의 자동 삭제 대상이 아닙니다. 추가 삭제가 필요한 경우 아래 연락처로 문의해 주세요.</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>리뷰 공개 범위:</strong> 리뷰의 별점, 의견, 표시 이름은 다른 이용자가 볼 수 있습니다. 신규 리뷰의 내부 소유권 정보는 공개 리뷰 문서와 분리해 비공개 사용자 데이터로 저장하며, 공개 리뷰 문서 ID에는 계정 UID를 사용하지 않습니다. 이전 형식으로 저장된 리뷰는 소유권을 임의 추정하지 않고 별도 검수·이관 대상으로 처리합니다.</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>법령에 의한 보관:</strong> 관련 법령에 따라 일정 기간 보관이 필요한 정보는 해당 기간 동안 안전하게 보관 후 파기합니다.</p>
            </div>
          </section>

          {/* 6. 쿠키 및 광고 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>6. 쿠키 및 광고 (Google AdSense)</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.9 }}>
              <p style={{ marginBottom: '12px' }}>
                본 사이트는 <strong style={{ color: 'var(--text-primary)' }}>Google AdSense</strong>를 이용하여 광고를 게재할 수 있습니다. Google AdSense는 쿠키(Cookie)를 사용하여 사용자의 관심사에 맞는 광고를 표시합니다.
              </p>
              <p style={{ marginBottom: '12px' }}>
                Google의 광고 쿠키 사용에 관한 자세한 내용은{' '}
                <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>
                  Google 광고 정책
                </a>을 확인하세요.
              </p>
              <p>
                쿠키 사용을 거부하려면 브라우저 설정에서 쿠키 저장을 비활성화하거나{' '}
                <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>
                  광고 개인화 거부 페이지
                </a>를 이용하세요.
              </p>
            </div>
          </section>

          {/* 7. 사용자 권리 */}
          <section className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>7. 사용자의 권리</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <p>사용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
              {['개인정보 열람 요청', '개인정보 정정·삭제 요청', '개인정보 처리 정지 요청', '개인정보 이동 요청'].map(r => (
                <div key={r} style={{ display: 'flex', gap: '8px' }}><span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>✓</span>{r}</div>
              ))}
              <p style={{ marginTop: '8px' }}>
                권리 행사는 서비스 내 &quot;계정 설정&quot;에서 직접 처리하시거나, 아래 연락처로 문의해 주세요.
              </p>
            </div>
          </section>

          {/* 8. 연락처 */}
          <section className="card" style={{ padding: '28px', borderColor: 'rgba(217,119,6,0.3)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-primary)' }}>8. 개인정보 보호책임자 및 문의</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.9 }}>
              <p><strong style={{ color: 'var(--text-primary)' }}>책임자:</strong> {operatorName}</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>이메일:</strong>{' '}
                <a href={`mailto:${contactEmail}`} style={{ color: 'var(--accent-primary)' }}>{contactEmail}</a>
              </p>
              <p style={{ marginTop: '12px' }}>
                개인정보 관련 불만 또는 피해 신고는 아래 기관에도 접수하실 수 있습니다.
              </p>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <a href="https://www.privacy.go.kr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}>개인정보보호위원회 → privacy.go.kr</a>
                <a href="https://cybercrime.go.kr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}>사이버범죄 신고 → cybercrime.go.kr</a>
              </div>
            </div>
          </section>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
            이 개인정보처리방침은 {lastUpdated}부터 적용됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
