# 글 분류와 이어 읽기

기존 permalink `/posts/:title/`를 유지한다. 모든 새 글의 front matter에 topic을 지정한다.

- ai: AI·자동화 (모델, 에이전트, 사내 AI)
- cloud: 클라우드·DevOps (인프라, 배포, 운영)
- security: 보안·인증 (IAM, 탐지, 보안 자동화)
- data: 데이터·추천 (CDC, 추천, 평가)
- development: 개발·인터랙션 (애플리케이션, UI, 게임)

주제는 글의 주된 질문으로 하나를 고르고 세부 기술은 기존 categories와 tags로 표시한다.
연결된 글에는 `_data/series.json`의 id를 `series`에 넣고 `series_order`를 숫자로 지정한다.
이어 읽기는 공개된 글만 표시되며 미발행 글 링크를 만들지 않는다.

예정된 사내 AI 6편은 `topic: ai`, `series: internal-ai`, `series_order: 1`부터 `6`을 지정한다.
기존 글의 본문과 URL을 변경하지 않고 주제별 탐색을 추가한다.
