/**
 * @file adminConfig.ts
 * @description 관리자 권한 설정 파일입니다.
 * 관리자 이메일 목록을 정의하며, 삭제·수정 등 관리자 전용 기능의 접근 제어에 사용됩니다.
 * @why 클라이언트 측 UI 가드와 서버 측 Firestore Rules 양쪽에서 일관된 관리자 식별을 위해 존재합니다.
 *      클라이언트 가드는 UX 보호(버튼 숨김)이고, 실제 보안은 Firestore Rules가 담당합니다.
 */

/**
 * 관리자 이메일 목록.
 * 이 목록에 포함된 Google 계정으로 로그인한 사용자만 관리자 기능에 접근할 수 있습니다.
 */
export const ADMIN_EMAILS: readonly string[] = [
  'asulchoi@gmail.com',
];

/**
 * 주어진 이메일이 관리자인지 확인합니다.
 * @param email - 확인할 이메일 주소
 * @returns 관리자 여부 (boolean)
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
