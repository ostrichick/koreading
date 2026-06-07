/**
 * @file utils.ts (lib)
 * @description 한국어 독해 컴포넌트들에서 문장을 단어 단위로 분리하고 한글 여부를 검증할 때 사용하는 공통 유틸리티 모듈입니다.
 * @why 중복 코드를 제거하고, 기존 회원 페이지에 존재했던 온점 분리 오타 버그를 원천 해결하여 안정적인 독해 사전을 서비스하기 위해 구성되었습니다.
 */

/**
 * 문장을 띄어쓰기, 문장 부호, 아시아식 온점(。)/쉼표(、) 및 개행(\n)을 기준으로 안전하게 토큰화하는 함수입니다.
 * 문장 구조가 쪼개지지 않도록 분리 패턴을 캡처 그룹으로 유지하여 반환합니다.
 * 
 * @param text 분할할 한국어 문장 텍스트
 * @returns 분할된 문자열 토큰 배열
 */
export function tokenizeKorean(text: string): string[] {
  return text.split(/(\s+|[.!?,。、\n])/g).filter(t => t.length > 0);
}

/**
 * 전달받은 문자열 토큰이 실제 한글 음절이나 초성/종성을 지닌 한국어 단어인지 정규식을 사용하여 식별합니다.
 * 
 * @param token 검사할 단어 토큰
 * @returns 한글 포함 시 true, 기호나 타 언어일 시 false
 */
export function isKoreanWord(token: string): boolean {
  return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(token);
}
