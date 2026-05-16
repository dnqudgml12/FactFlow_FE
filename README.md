# FactFlow <img src="icon-128.png" alt="FactFlow 로고" width="27" style="vertical-align: middle; margin-right: 8px;" />

## 프로젝트 소개

**FactFlow FE**는 **Next.js**, **TypeScript** 기반 **뉴스 기사 URL 분석** UI이다. 분석 로직은 **FactFlow_BE (Spring Boot)** API로 위임하고, 화면은 결과를 렌더링한다. 상태에는 **Recoil** 등을 사용한다.

### 개발 기간
- 2025.06 ~ 07

### 팀 소개
| [**우병희**](https://github.com/dnqudgml12) | [**김현중**](https://github.com/hjkim0905) | [**윤동혁**](https://github.com/Diggydogg) |
|---|---|---|
| Frontend, Langchain | Frontend |  Frontend, Langchain |

## 아키텍처 (현재)

- 분석 요청은 **Spring 백엔드**(동일 레포 상위 디렉터리 `FactFlow_BE`)의 `POST /api/v1/news/analyze`로 전달한다.
- FE `.env`(또는 `.env.local`)에 **`NEXT_PUBLIC_BACKEND_URL=http://localhost:8080`** 형태로 베이스 URL을 설정한다.

## 주요 기술 (FE)

## 개발 기간

- 진행 중

## 배포 · 실행 환경

- **Next.js** 웹 앱으로 로컬에서 `npm run dev`로 실행한다.
- 프로덕션 배포는 **Vercel** 등 Next 호스팅에 맞춰 설정하면 된다. (팀 배포 URL이 정해지면 이 항목에 추가한다.)

---

## 시작 가이드

### 요구 사항

- Node.js (LTS 권장)
- npm

### 환경 변수

- **`NEXT_PUBLIC_BACKEND_URL`** — 필수. Spring 서버 베이스 URL (예: `http://localhost:8080`).  
- LLM·네이버 키는 **백엔드**( `FactFlow_BE` ) 실행 환경에 설정한다. (자세히는 해당 프로젝트 `application.yml` 참고.)

### 배포 참고

- Next를 **별도 호스팅**(Vercel 등)하면, 크롬 익스텐션 또는 브라우저에서는 **공개 가능한 HTTPS 백엔드 URL**을 `NEXT_PUBLIC_BACKEND_URL` 에 넣어야 한다. CORS는 `FactFlow_BE` 의 `factflow.cors` 설정으로 맞춘다.

### 설치 및 실행

```bash
git clone https://github.com/hjkim0905/FactFlow_FE.git
cd FactFlow_FE
npm install
```

**개발 서버 (Turbopack)**

```bash
npm run dev
```

**프로덕션 빌드 및 실행**

```bash
npm run build
npm start
```

### 기타 스크립트

```bash
npm run lint   # Next.js ESLint
```

---

## 기술 스택

### 개발 환경

![Visual Studio Code](https://img.shields.io/badge/VS%20Code-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

### 언어 · 프레임워크

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)

### AI · 분석 서버

- 모델·크롤링·네이버 연동은 **`FactFlow_BE` (Spring Boot)** 에서 처리한다.

### 상태 · 스타일

![Recoil](https://img.shields.io/badge/Recoil-3578E5?style=for-the-badge&logo=recoil&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

### UI · 도구

![Heroicons](https://img.shields.io/badge/Heroicons-8B5CF6?style=for-the-badge&logo=heroicons&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)

---

## 화면 구성


### 서비스 플로우

![초기 화면](./docs/factflow-initial.png)

**서비스 진입 시 보여 주는 초기 화면이다.**

![분석 로딩](./docs/factflow-loading.png)

**백엔드 분석이 진행되는 동안 진행 상태를 보여 주는 로딩 화면이다.**


![메인 입력](./docs/factflow-input.png)

**분석한 뉴스의 요약·키워드·감정 등 상세 분석 결과를 보여 주는 화면이다.**


![관련 기사](./docs/factflow-related-articles.png)

**본 기사와 연관된 기사 및 비판적·확장적 사고를 돕기 위해, 기사 내용과 연결된 추천 질문과 질문 의도 설명을 보여 준다.**


![생각 질문](./docs/factflow-thinking-questions.png)

**추천 질문에 대한 질문 의도 설명을 보여 준다**

![알림](./docs/factflow-alert.png)

**기사를 네 단계(배경·전개·핵심·파급 등)로 나눈 짧은 머리글을 보여 준다.**


![상세 분석](./docs/factflow-detail-analysis.png)

**짧은 머리글에 대한 자세한 설명을 보여 준다.**

![관련 뉴스](./docs/factflow-related-news.png)

**유사하거나 이어 읽을 만한 관련 뉴스를 안내하는 영역이다.**

---

## 아키텍처 및 디렉터리 구조

```text
FactFlow_FE/
├── public/                 # 정적 자산, SVG 등
├── app/
│   ├── layout.tsx
│   ├── page.tsx            # 메인(폼 / 로딩 / 결과)
│   └── api/                # Route Handlers (OG 이미지 등)
├── components/             # NewsAnalysisForm, 결과·로딩 UI 등
├── lib/
│   └── hooks/              # useNewsAnalysis
├── docs/                   # README용 스크린샷 (파일명 영어)
├── package.json
├── next.config.mjs
└── tsconfig.json
```

---

## 라우트

| 경로 | 설명 |
|------|------|
| `/` | 메인 — 뉴스 URL 입력 및 분석 결과 |

주요 API (FE · 참고)

| 경로 | 설명 |
|------|------|
| `GET /api/og-image` | OG 메타 이미지 등 보조 엔드포인트 |

분석 본 기능은 **`{NEXT_PUBLIC_BACKEND_URL}/api/v1/news/analyze`** (Spring) 를 사용한다.

---
