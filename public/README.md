# 정식 현황판 (나주)

웹 기반 정식/육묘 현황판 + SQLite DB

## 폴더 구조

```
artifacts/
├── server.py              # Python 서버 (SQLite + API)
├── status_board.db        # SQLite DB (실행 시 자동 생성)
└── status_board/
    ├── index.html         # HTML
    ├── css/style.css      # CSS
    └── js/app.js          # JavaScript
```

## 로컬 실행

```bash
cd artifacts
python3 server.py
```

브라우저에서 http://localhost:8765 접속

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/health` | 서버/DB 상태 |
| GET | `/api/data` | 전체 데이터 조회 |
| POST | `/api/plant` | 정식일 저장 `{sheet, floor, zone, date}` |
| POST | `/api/formal-days` | 정식일수 변경 `{sheet, days}` |
| POST | `/api/clear` | 해당 동 날짜 초기화 `{sheet}` |
| POST | `/api/import` | JSON 전체 가져오기 |

## 배포

### 환경변수
- `PORT` : 서버 포트 (기본 8765)

### 예시 (Linux/VPS)
```bash
python3 server.py
# 또는
PORT=8080 python3 server.py
```

### systemd 예시
```ini
[Unit]
Description=Status Board
After=network.target

[Service]
WorkingDirectory=/path/to/artifacts
ExecStart=/usr/bin/python3 server.py
Restart=always
Environment=PORT=8765

[Install]
WantedBy=multi-user.target
```

## 기능
- 월/일(MM/DD)만 입력 → 현재 연도 자동 적용
- 재배일수 = 오늘 − 정식일
- 수확일 = 정식일 + 정식일수
- 날짜 변경 시 SQLite에 즉시 저장
- 서버 미실행 시 브라우저 localStorage 폴백
