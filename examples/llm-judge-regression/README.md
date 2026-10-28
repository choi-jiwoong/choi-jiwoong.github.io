# LLM 평가 회귀 테스트

모든 입력·기대 판정·평가 결과는 설명용 가상 데이터입니다. 모델 API를 호출하지 않습니다.

```sh
cd examples/llm-judge-regression
python3 -m unittest -v
python3 compare.py
```

`compare.py`는 의도적으로 넣은 판정 악화를 감지해 `FAIL`과 종료 코드 1을 반환합니다.
기준선은 12개 항목 중 12개, 후보는 10개가 기대 판정과 일치합니다.
이는 집계 코드 시연이며 실제 평가 모델의 성능이나 사람 일치율을 뜻하지 않습니다.
