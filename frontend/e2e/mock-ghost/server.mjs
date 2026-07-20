// E2Eテスト用のGhost Content APIモックサーバー。
// 実サーバー(Ghost CMS)なしでAstroのSSRを動かすため、
// @tryghost/content-apiが叩くエンドポイントをfixtureで再現する。
// Playwrightのconfig(webServer)から起動される。
import { createServer } from "node:http";
import { posts, tags } from "./fixtures.mjs";

const PORT = Number(process.env.MOCK_GHOST_PORT ?? 3999);

// GhostのNQLフィルターのうち、このアプリが実際に使う形式だけを解釈する:
//   slug:'x' / slug:[a,b] / featured:true / tag:x / visibility:public
function applyFilter(items, filter, type) {
  if (!filter) return items;
  let result = items;
  // NQLのAND結合(+)で分割して順に絞り込む
  for (const clause of filter.split("+")) {
    if (clause.startsWith("slug:[")) {
      const slugs = clause
        .slice("slug:[".length, -1)
        .split(",")
        .map((s) => decodeURIComponent(s.trim()));
      result = result.filter((item) => slugs.includes(item.slug));
    } else if (clause.startsWith("slug:")) {
      const slug = decodeURIComponent(
        clause.slice("slug:".length).replace(/^'|'$/g, ""),
      );
      result = result.filter((item) => item.slug === slug);
    } else if (clause === "featured:true") {
      result = result.filter((item) => item.featured === true);
    } else if (clause.startsWith("tag:") && type === "posts") {
      const tagSlug = decodeURIComponent(clause.slice("tag:".length));
      result = result.filter((item) =>
        (item.tags ?? []).some((t) => t.slug === tagSlug),
      );
    } else if (clause.startsWith("visibility:")) {
      const visibility = clause.slice("visibility:".length);
      result = result.filter((item) => item.visibility === visibility);
    }
  }
  return result;
}

// order指定(published_at desc等)を解釈する。未対応の指定は元の順序を維持
function applyOrder(items, order) {
  if (!order) return items;
  const [field, direction = "asc"] = order.split(" ");
  const dir = direction.toLowerCase() === "desc" ? -1 : 1;
  const getValue = (item) => {
    if (field === "published_at") return item.published_at ?? "";
    if (field === "count.posts") return item.count?.posts ?? 0;
    return null;
  };
  if (getValue(items[0] ?? {}) === null) return items;
  return [...items].sort((a, b) => (getValue(a) > getValue(b) ? dir : -dir));
}

function paginate(items, limitParam, pageParam) {
  const total = items.length;
  // Ghost APIと同じくlimit未指定は15件、"all"は全件、最大100件
  const limit =
    limitParam === "all"
      ? Math.max(total, 1)
      : Math.min(Number(limitParam) || 15, 100);
  const page = Math.max(Number(pageParam) || 1, 1);
  const pages = Math.max(Math.ceil(total / limit), 1);
  const sliced = items.slice((page - 1) * limit, page * limit);
  return {
    items: sliced,
    pagination: {
      page,
      limit,
      pages,
      total,
      next: page < pages ? page + 1 : null,
      prev: page > 1 ? page - 1 : null,
    },
  };
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === "/health") {
    return send(200, { status: "ok" });
  }

  // Ghost Content API: /ghost/api/content/posts/ または /ghost/api/content/tags/
  const match = url.pathname.match(/^\/ghost\/api\/content\/(posts|tags)\/?$/);
  if (!match) {
    return send(404, {
      errors: [{ message: "Resource not found", type: "NotFoundError" }],
    });
  }

  const type = match[1];
  const source = type === "posts" ? posts : tags;
  const filtered = applyFilter(source, url.searchParams.get("filter"), type);
  const ordered = applyOrder(filtered, url.searchParams.get("order"));
  const { items, pagination } = paginate(
    ordered,
    url.searchParams.get("limit"),
    url.searchParams.get("page"),
  );
  return send(200, { [type]: items, meta: { pagination } });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock Ghost API listening on http://127.0.0.1:${PORT}`);
});
