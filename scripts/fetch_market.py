#!/usr/bin/env python3
"""日経平均・関連指標と当日の株式ニュースを取得して stock/data/market.json に保存する。

標準ライブラリのみで動作する（GitHub Actions から定期実行する想定）。
いずれかの取得に失敗した場合は、前回保存したデータをそのまま残す。
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

JST = timezone(timedelta(hours=9))
OUT_PATH = Path(__file__).resolve().parent.parent / "stock" / "data" / "market.json"
UA = "Mozilla/5.0 (compatible; market-dashboard/1.0)"

# 表示する指標（Yahoo Finance のシンボル）
INDICES = [
    {"id": "nikkei", "name": "日経平均株価", "symbol": "^N225", "unit": "円", "digits": 2},
    {"id": "dow", "name": "NYダウ", "symbol": "^DJI", "unit": "ドル", "digits": 2},
    {"id": "usdjpy", "name": "ドル/円", "symbol": "JPY=X", "unit": "円", "digits": 2},
]

# ニュース検索キーワード（Google ニュース RSS）
NEWS_QUERIES = [
    "日経平均",
    "東証 株価",
    "株式市場 決算",
]
NEWS_LIMIT = 40


def http_get(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def fetch_chart(symbol: str, range_: str, interval: str) -> dict:
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + urllib.parse.quote(symbol)
        + f"?range={range_}&interval={interval}"
    )
    data = json.loads(http_get(url))
    result = data["chart"]["result"][0]
    return result


def series_from(result: dict) -> list[list]:
    """[[unix秒, 終値], ...] を返す（欠損値は除外）。"""
    ts = result.get("timestamp") or []
    closes = result["indicators"]["quote"][0].get("close") or []
    return [[t, round(c, 2)] for t, c in zip(ts, closes) if c is not None]


def fetch_index(spec: dict) -> dict:
    intraday = fetch_chart(spec["symbol"], "1d", "5m")
    daily = fetch_chart(spec["symbol"], "3mo", "1d")
    meta = intraday["meta"]

    quote = intraday["indicators"]["quote"][0]
    highs = [v for v in (quote.get("high") or []) if v is not None]
    lows = [v for v in (quote.get("low") or []) if v is not None]
    opens = [v for v in (quote.get("open") or []) if v is not None]

    price = meta.get("regularMarketPrice")
    prev = meta.get("chartPreviousClose") or meta.get("previousClose")
    change = price - prev if price is not None and prev else None
    change_pct = change / prev * 100 if change is not None else None

    return {
        "id": spec["id"],
        "name": spec["name"],
        "symbol": spec["symbol"],
        "unit": spec["unit"],
        "digits": spec["digits"],
        "price": price,
        "previousClose": prev,
        "change": round(change, 2) if change is not None else None,
        "changePercent": round(change_pct, 2) if change_pct is not None else None,
        "open": opens[0] if opens else None,
        "high": meta.get("regularMarketDayHigh") or (max(highs) if highs else None),
        "low": meta.get("regularMarketDayLow") or (min(lows) if lows else None),
        "marketTime": meta.get("regularMarketTime"),
        "intraday": series_from(intraday),
        "daily": series_from(daily),
    }


def fetch_news() -> list[dict]:
    items: dict[str, dict] = {}
    for q in NEWS_QUERIES:
        url = (
            "https://news.google.com/rss/search?q="
            + urllib.parse.quote(f"{q} when:1d")
            + "&hl=ja&gl=JP&ceid=JP:ja"
        )
        root = ET.fromstring(http_get(url))
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            source = (item.findtext("source") or "").strip()
            pub = item.findtext("pubDate")
            if not title or not link:
                continue
            # Google ニュースのタイトル末尾「 - 媒体名」を除去
            if source and title.endswith(" - " + source):
                title = title[: -len(" - " + source)]
            try:
                published = parsedate_to_datetime(pub).astimezone(JST).isoformat() if pub else None
            except (TypeError, ValueError):
                published = None
            key = title
            if key not in items:
                items[key] = {
                    "title": title,
                    "link": link,
                    "source": source,
                    "published": published,
                    "tag": q.split()[0],
                }
    news = sorted(items.values(), key=lambda x: x["published"] or "", reverse=True)
    return news[:NEWS_LIMIT]


def load_previous() -> dict:
    try:
        return json.loads(OUT_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def main() -> int:
    prev = load_previous()
    prev_indices = {i["id"]: i for i in prev.get("indices", [])} if not prev.get("sample") else {}
    errors: list[str] = []

    indices = []
    for spec in INDICES:
        try:
            indices.append(fetch_index(spec))
        except Exception as e:  # noqa: BLE001 - 取得失敗時は前回値を使う
            errors.append(f"{spec['symbol']}: {e}")
            if spec["id"] in prev_indices:
                indices.append(prev_indices[spec["id"]])

    try:
        news = fetch_news()
    except Exception as e:  # noqa: BLE001
        errors.append(f"news: {e}")
        news = [] if prev.get("sample") else prev.get("news", [])

    if not indices and not news:
        print("すべての取得に失敗しました:\n" + "\n".join(errors), file=sys.stderr)
        return 1

    out = {
        "updatedAt": datetime.now(JST).isoformat(timespec="seconds"),
        "sample": False,
        "indices": indices,
        "news": news,
        "errors": errors,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"saved {OUT_PATH} (indices={len(indices)}, news={len(news)}, errors={len(errors)})")
    for e in errors:
        print("  warn:", e, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
