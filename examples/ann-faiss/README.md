# ann-faiss

검증일: 2026-10-22

Python 3.12.14 / Linux x86_64에서 확인했다. `python3 -m venv .venv`, `. .venv/bin/activate`, `pip install -r requirements.txt`, `python benchmark.py` 순으로 실행한다. 합성 난수 데이터, 1 스레드, 동일 200개 질의의 5회 반복이다. RSS는 전체 프로세스의 누적 최대치이고 직렬화 크기와 다르다. 공유 환경의 지연은 운영 성능을 대표하지 않는다. resource 모듈 때문에 Unix 환경이 필요하다.
