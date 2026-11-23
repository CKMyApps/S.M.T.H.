const configured = (window as Window & {SMTH_SCORE_API?:string}).SMTH_SCORE_API;
export const online = typeof configured === "string" && /^https:\/\//i.test(configured);
let sessionToken = "";
function playerToken() {
  if (sessionToken) return sessionToken;
  const key = "ckmyapps.airtime.v1.onlinePlayer";
  try {
    sessionToken = localStorage.getItem(key) || crypto.randomUUID();
    localStorage.setItem(key,sessionToken);
  } catch { sessionToken ||= crypto.randomUUID(); }
  return sessionToken;
}
export function scores(params: string, options: RequestInit) {
  if (!online) throw new Error("Online rankings are not connected.");
  const headers = new Headers(options.headers);
  headers.set("Authorization","Bearer "+playerToken());
  return fetch(configured+params,{...options,headers,credentials:"omit",referrerPolicy:"no-referrer",redirect:"error"});
}
