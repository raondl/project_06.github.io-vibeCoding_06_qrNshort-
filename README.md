# QuickLink Suite : QR코드 생성 및 URL 단축 올인원 웹앱

> **버전**: v1.0.0  
> **과목**: 바이브코딩 실습 프로젝트 06  
> **기술 스택**: HTML5, Vanilla CSS (Glassmorphism), JavaScript (ES6+), Public OpenAPI (is.gd, v.gd, TinyURL), QRCode.js  

---

## 1. 프로젝트 개요 (Overview)

### 1.1 개발 배경 및 목적
인터넷 웹 환경에서 마케팅, 강의 자료 공유, SNS 게시물 배포 시 복잡하고 긴 URL 주소는 가독성을 떨어뜨리고 사용자 접근성을 저해합니다.  
본 프로젝트 **QuickLink Suite**는 이러한 문제를 해결하기 위해, 사용자가 원하는 방식으로 웹 주소를 변환할 수 있는 두 가지 핵심 도구를 하나의 통합 플랫폼으로 제공합니다:
1. **QR코드 생성기 (`url2qr`)**: 긴 URL을 스마트폰 카메라로 즉시 스캔 가능한 고해상도 QR 코드로 변환 및 JPG 이미지 파일로 다운로드.
2. **스마트 URL 단축기 (`urlShort`)**: 무료 공공 Open API를 통해 복잡한 긴 링크를 직관적이고 간결한 단축 URL로 즉시 압축하고 원클릭 클립보드 복사 지원.

### 1.2 시스템 아키텍처 및 폴더 구조
```
프로젝트_06/
├── index.html              # 통합 메인 포털 허브 (QR코드 및 URL단축 선택 카드/헤더)
├── style.css               # 메인 포털 디자인 스타일시트
├── img/
│   └── logo.png            # 서비스 메인 브랜딩 로고
├── url2qr/                 # [기능 1] QR 코드 생성기 모듈
│   ├── index.html          # QR코드 생성기 메인 페이지 (공통 네비게이션 연동)
│   ├── style.css           # QR코드 생성기 스타일 (Glassmorphism & Radial Mesh)
│   ├── script.js           # QR코드 렌더링, 다운로드 및 파라미터 수신 로직
│   └── img/
│       └── logo.png        # QR 모듈 로고
└── urlShort/               # [기능 2] 스마트 URL 단축기 모듈 (신규 개발)
    ├── index.html          # URL 단축기 메인 페이지
    ├── style.css           # URL 단축기 모던 UI, 비활성화/스피너/토스트 스타일
    ├── script.js           # 입력 유효성 검사, OpenAPI 통신, 클립보드 복사, 히스토리
    └── img/
        └── logo.png        # URL 단축 모듈 로고
```

---

## 2. 화면 구성 및 내비게이션 연계 명세

| 구분 | 화면 / 모듈 | URL / 파일 위치 | 주요 역할 및 연결 구조 |
| :--- | :--- | :--- | :--- |
| **메인 허브** | 통합 포털 홈 | `index.html` | • 상단 내비게이션의 **[QR코드]**, **[URL단축]** 버튼 제공<br>• 두 도구로 즉시 분기할 수 있는 대화형 액션 카드 제공 |
| **기능 1** | QR코드 생성기 | `url2qr/index.html` | • 상단 헤더에 **[홈]**, **[QR코드 (활성)]**, **[URL단축]** 버튼 제공<br>• URL 단축기(`urlShort`)와 1-Click 상호 전환 지원 |
| **기능 2** | 스마트 URL 단축기 | `urlShort/index.html` | • 상단 헤더에 **[홈]**, **[QR코드]**, **[URL단축 (활성)]** 버튼 제공<br>• 단축된 URL을 QR 코드로 즉각 변환하는 연계 기능 탑재 |

---

## 3. 기능 상세 명세서 (Functional Specification)

### 3.1 QR코드 생성 기능 (`url2qr`)
- **[FN-QR-01] URL 입력 및 엔터키 지원**: 웹사이트 주소를 입력하고 '생성하기' 버튼을 누르거나 `Enter` 키를 입력하면 QR코드가 즉시 생성됩니다.
- **[FN-QR-02] 동적 레이아웃 애니메이션**: QR코드가 생성되면 입력창이 하단으로 부드럽게 이동하고 생성된 QR 카드가 화면 중앙에 페이드인됩니다.
- **[FN-QR-03] JPG 이미지 원클릭 다운로드**: 생성된 QR 코드 캔버스 클릭 시 고화질 `qrcode.jpg` 파일로 로컬 PC에 자동 다운로드됩니다.
- **[FN-QR-04] 크로스 딥링크 지원**: URL 파라미터(`?url=...`)를 감지하여 타 모듈(URL단축기)에서 넘어온 단축 주소를 자동으로 로드하고 즉각 QR코드로 렌더링합니다.

### 3.2 URL 단축 기능 (`urlShort`)
- **[FN-US-01] URL 입력창 및 초기화 버튼**:
  - 단축할 원본 주소를 입력하는 `<input type="url">` 제공.
  - 글자 입력 시 우측에 원터치 내용 지우기(`×`) 버튼 자동 노출.
- **[FN-US-02] '단축하기' 버튼 조건부 비활성화 (요구사항 3-2)**:
  - 입력 필드가 비어있거나 공백일 경우 `shorten-btn`의 `disabled` 속성이 활성화되어 클릭을 방지.
  - 시각적으로 회색 톤(`opacity: 0.8`, `cursor: not-allowed`)으로 처리하여 비활성 상태를 명확히 고지.
  - 1글자 이상의 유효 텍스트가 입력되면 실시간으로 버튼이 활성화(`disabled = false`).
- **[FN-US-03] 공공 Open API 기반 URL 단축 요청 및 응답 (요구사항 3-3)**:
  - 사용자가 입력한 주소에 `http://` 또는 `https://` 프로토콜이 누락된 경우 자동 보정.
  - 비동기 `fetch()` 통신 수행 중 버튼 내부에 로딩 스피너 애니메이션 및 '단축 중...' 텍스트 표시.
  - 3중 다중 Fallback 아키텍처 적용:
    1. **1순위**: `is.gd` 공식 REST API (CORS Origin: `*` 공식 지원)
    2. **2순위**: `v.gd` 공식 REST API (안전 점검 및 CORS 지원)
    3. **3순위**: `TinyURL` API + AllOrigins Proxy 우회
  - API 응답으로 전달받은 단축 주소를 **읽기 전용 출력 상자(`readonly`)**에 즉각 반영.
- **[FN-US-04] 클립보드 자동 복사 및 알림 (요구사항 3-4)**:
  - '복사' 버튼 클릭 시 `navigator.clipboard.writeText()`를 호출하여 단축된 URL을 클립보드에 즉시 저장.
  - 사용자 요구사항에 따라 표준 **브라우저 알림창 (`alert('복사하였습니다')`)** 호출.
  - 부가적으로 모던한 **하단 플로팅 토스트 메시지**를 동시에 표시하여 UX 완성도 제고.
- **[FN-US-05] 부가 편의 기능**:
  - **새 탭에서 열기**: 단축된 링크가 정상 동작하는지 새 브라우저 창에서 즉시 검증 가능.
  - **QR코드로 만들기**: 단축된 URL을 인자로 넘기며 `../url2qr/index.html?url=...`로 이동하여 1초 만에 QR코드 생성.
  - **최근 단축 기록 (Local History)**: 최근 단축한 주소 5건을 브라우저 `localStorage`에 보관하여 재복사 및 확인 가능.

---

## 4. OpenAPI 연동 상세 규격

### 4.1 기본 엔드포인트: is.gd REST API
- **엔드포인트 URL**: `https://is.gd/create.php`
- **HTTP Method**: `GET`
- **Request 파라미터**:
  - `format`: `json` (응답 형식)
  - `url`: 단축할 대상 원본 URL (URL Encoded)
- **Response 규격 (200 OK)**:
  ```json
  {
    "shorturl": "https://is.gd/EuvYes"
  }
  ```
- **Error Response 규격**:
  ```json
  {
    "errorcode": 1,
    "errormessage": "Please enter a valid URL to shorten"
  }
  ```

### 4.2 폴백(Fallback) 엔드포인트: v.gd REST API
- **엔드포인트 URL**: `https://v.gd/create.php`
- **HTTP Method**: `GET`
- **파라미터 및 응답 형식**: `is.gd`와 100% 동일
