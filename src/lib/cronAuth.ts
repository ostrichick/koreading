export function isAuthorizedCron(headers: Headers, secret: string | undefined): boolean {
  return Boolean(secret && headers.get('authorization') === `Bearer ${secret}`);
}
