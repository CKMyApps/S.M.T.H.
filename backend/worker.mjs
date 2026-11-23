const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rankSql = `WITH ordered AS (
  SELECT player, nickname, airtime, created, attempt,
    ROW_NUMBER() OVER (PARTITION BY player ORDER BY airtime DESC, created, attempt) AS best
  FROM scores WHERE created >= ?
) SELECT nickname, airtime, CASE WHEN player = ? THEN 1 ELSE 0 END AS mine
FROM ordered WHERE best = 1 ORDER BY airtime DESC, created, attempt LIMIT 10`;

function startOfPeriod(period) {
  if (period === "world") return 0;
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  if (period === "week") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.getTime();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (url.pathname !== "/api/scores") return new Response(null,{status:404});
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return new Response(null,{status:403});
    const headers = {"Access-Control-Allow-Origin":origin,"Vary":"Origin","Cache-Control":"no-store"};
    const reply = (data,status=200) => Response.json(data,{status,headers});
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:{
      ...headers,"Access-Control-Allow-Methods":"GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Max-Age":"600"
    }});
    if (!["GET","POST"].includes(request.method)) return reply({error:"Unsupported method."},405);
    const token = /^Bearer (.+)$/.exec(request.headers.get("Authorization") || "")?.[1];
    if (!token || !uuid.test(token)) return reply({error:"Missing player identifier."},401);
    try {
      const hash = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
      const player = Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
      if (request.method === "GET") {
        const period = url.searchParams.get("period") || "world";
        if (!["today","week","world"].includes(period)) return reply({error:"Unknown period."},400);
        const data = await env.DB.prepare(rankSql).bind(startOfPeriod(period),player).all();
        return reply({entries:data.results});
      }
      if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return reply({error:"Use JSON."},415);
      const input = await request.json().catch(()=>null);
      const nickname = typeof input?.nickname === "string" ? input.nickname.trim() : "";
      if (!uuid.test(input?.attempt || "") || !Number.isInteger(input?.airtime) || input.airtime < 120 || input.airtime > 2500)
        return reply({error:"Invalid attempt."},400);
      if (!/^[\p{L}\p{N} _.-]{1,16}$/u.test(nickname))
        return reply({error:"Use 1–16 letters, numbers, spaces, dots, dashes or underscores."},400);
      await env.DB.prepare("INSERT INTO scores (attempt, player, nickname, airtime, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT(attempt) DO NOTHING")
        .bind(input.attempt,player,nickname,input.airtime,Date.now()).run();
      const owner = await env.DB.prepare("SELECT player FROM scores WHERE attempt = ?").bind(input.attempt).first();
      if (owner?.player !== player) return reply({error:"Attempt already posted."},409);
      return reply({posted:true});
    } catch { return reply({error:"Rankings are currently unavailable."},503); }
  }
};
