# 今日の株式市場

日経平均株価（＋NYダウ・ドル/円）のチャートと、その日の株式ニュースを一覧できる静的ページです。

## 仕組み

- `scripts/fetch_market.py` が Yahoo Finance（株価）と Google ニュース RSS（ニュース）からデータを取得し、`stock/data/market.json` に保存します（Python 標準ライブラリのみ）。
- `.github/workflows/update-market.yml` が平日の取引時間中は30分ごと、夕方にも実行して JSON を更新・コミットします。
- ページ（`stock/index.html`）はその JSON を読み込んで表示し、5分ごとに自動再読み込みします。

初期状態の `market.json` はサンプルデータです（画面上部に表示されます）。

## 使い方

1. このブランチを main にマージする（スケジュール実行はデフォルトブランチでのみ動きます）
2. Actions タブから「Update market data」を手動実行（Run workflow）して実データを取得
3. GitHub Pages を有効にし、`/stock/` を開く

ローカル確認:

```bash
python3 scripts/fetch_market.py
python3 -m http.server 8000   # http://localhost:8000/stock/
```

## カスタマイズ

- 表示する指標: `fetch_market.py` の `INDICES`
- ニュースの検索キーワード: 同 `NEWS_QUERIES`
