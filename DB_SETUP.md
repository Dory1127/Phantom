# 외부 무료 MySQL DB 설정 안내

## 1. PlanetScale 추천
1. https://planetscale.com/ 에 가입하세요.
2. 무료 프랜으로 새 데이터베이스를 만드세요.
3. `Connect`에서 `MySQL`을 선택하고 연결 정보를 확인하세요.
4. `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` 값을 가져옵니다.

## 2. `.env` 파일 생성
아래 내용을 `.env`로 저장하세요.

```
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-database-name
JWT_SECRET=your-secure-jwt-secret
```

## 3. 데이터베이스 스키마 적용
`schema.sql` 파일을 외부 DB에 실행하세요.

- PlanetScale 콘솔의 `SQL Editor`를 사용하거나
- 터미널에서 `mysql` 클라이언트를 사용하세요.

## 4. 앱 실행
1. 프로젝트 루트에 `.env`를 생성합니다.
2. 외부 DB에 연결된 `.env`를 채웁니다.
3. 서버를 실행합니다:
   - `npm install` (한 번만)
   - `npm run dev` 또는 `npm start`

## 5. 내가 해야 할 일
- PlanetScale에 가입하고 데이터베이스를 만드세요.
- 연결 정보를 `.env`에 입력하세요.
- `schema.sql`을 실행해서 테이블을 만드세요.
- `JWT_SECRET`는 임의의 문자열로 설정하세요.
- 서버를 실행해서 연결이 되는지 확인하세요.

## 빠른 확인
- 데이터가 외부 DB에 저장되므로 학교 컴퓨터를 재부팅해도 유지됩니다.
- `DB_HOST`와 `DB_USER` 정보가 정확하지 않으면 연결 실패합니다.
