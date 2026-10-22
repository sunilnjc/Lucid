/**
 * Authored Korean support for the canonical Sales, People and Consulting senses.
 * The English term and example remain the learning source. These notes explain
 * the role-specific meaning and usage; they do not alter content IDs or scoring.
 */
export const koreanPeopleWords: Record<string, Record<string, { meaning: string; usage: string }>> = {
  "sales-business-development": {
    "finance-discrepancy": {
      "meaning": "서로 일치해야 할 수치나 설명, 기록 사이에 확인이 필요한 차이가 있다는 뜻입니다.",
      "usage": "견적이나 고객 기록의 차이를 짚을 때 원인을 오류로 단정하지 않고 사용합니다."
    },
    "finance-provisional": {
      "meaning": "현재는 잠정적으로 제안하거나 합의했지만 추가 정보에 따라 바뀔 수 있다는 뜻입니다.",
      "usage": "최종 약속과 임시 조건을 구분하고 아직 확정하지 않은 사항을 설명할 때 사용합니다."
    },
    "finance-quantify": {
      "meaning": "금액이나 효과, 차이를 명확한 방법에 따라 수치로 나타내는 것입니다.",
      "usage": "고객이 검토할 수 있도록 제안의 가치를 비용이나 시간 등의 수치로 설명할 때 사용합니다."
    },
    "finance-assumption": {
      "meaning": "견적이나 제안을 만들기 위해 아직 충분히 확인하지 않은 내용을 사실로 놓은 전제입니다.",
      "usage": "판매 예상의 바탕이 된 조건을 공개하고 고객과 함께 확인할 때 사용합니다."
    },
    "finance-sensitivity": {
      "meaning": "입력값이나 전제가 변할 때 예상 결과가 얼마나 달라지는지를 뜻합니다.",
      "usage": "가격이나 물량 변화가 사업성 계산에 미치는 영향을 설명할 때 사용합니다."
    },
    "finance-scenario": {
      "meaning": "특정 조건 아래에서 제안이 어떻게 작동할지 살펴보는 일관된 가상 상황입니다.",
      "usage": "고객과 여러 가능한 상황의 결과를 비교하고 대비할 때 사용합니다."
    },
    "finance-headroom": {
      "meaning": "예산이나 납품 역량 등 정해진 한도에 도달하기 전까지 남아 있는 여유입니다.",
      "usage": "추가 주문이나 할인, 변경을 받아들일 수 있는 범위를 설명할 때 사용합니다."
    },
    "finance-validate": {
      "meaning": "주장이나 전제, 제안한 방식에 의사결정을 뒷받침할 근거가 있는지 확인하는 것입니다.",
      "usage": "고객에게 제안하기 전 핵심 전제와 실제 근거가 맞는지 점검할 때 사용합니다."
    },
    "finance-threshold": {
      "meaning": "특정 결정이나 조치가 필요해지는 기준 수준 또는 조건입니다.",
      "usage": "할인 승인이나 계약 진행에 필요한 금액·증거 등의 기준을 명시할 때 사용합니다."
    },
    "finance-accountability": {
      "meaning": "결과나 결정에 대해 진행 상황을 설명하고 자신의 권한 안에서 문제를 해결해야 하는 책임입니다.",
      "usage": "영업과 납품팀 사이에서 누가 결과를 설명하고 미해결 문제에 대응할지 정할 때 사용합니다."
    },
    "finance-rationale": {
      "meaning": "특정 결정이나 권고, 영업 접근 방식이 타당한 이유를 연결해 설명한 것입니다.",
      "usage": "권장 범위나 가격, 추진 순서의 이유를 고객에게 설명할 때 사용합니다."
    },
    "finance-recommend": {
      "meaning": "목표와 상황에 맞는 근거를 들어 특정 선택이나 행동을 권하는 것입니다.",
      "usage": "여러 정보를 비교한 뒤 고객에게 적합한 다음 행동을 제안할 때 사용합니다."
    },
    "finance-feasible": {
      "meaning": "시간과 자원, 역량, 협조 등의 실제 제약 안에서 실행할 수 있다는 뜻입니다.",
      "usage": "매력적인 제안을 실제로 납품하고 지원할 수 있는지 검토할 때 사용합니다."
    },
    "finance-commitment": {
      "meaning": "이해하고 합의한 조건에 따라 특정 행동이나 제공 사항을 이행하겠다는 명확한 약속입니다.",
      "usage": "희망이나 아이디어와 당사자가 실제로 수락한 약속을 구분할 때 사용합니다."
    },
    "finance-caveat": {
      "meaning": "진술이나 견적, 권고를 정확히 해석하기 위해 알아야 할 중요한 단서나 한계입니다.",
      "usage": "유망한 수치에 적용 범위나 조건이 있을 때 함께 설명하며 구매 자격 심사와는 구분합니다."
    },
    "finance-exposure": {
      "meaning": "특정 위험이나 불리한 결과로 인해 사람이나 사업이 영향을 받을 수 있는 정도입니다.",
      "usage": "불확실한 거래에서 위험에 놓이는 자원이나 약속의 범위를 논의할 때 사용합니다."
    },
    "finance-safeguard": {
      "meaning": "거래에서 예상 가능한 문제를 막거나 특정 위험을 줄이기 위한 실질적인 장치입니다.",
      "usage": "고객 관계와 납품을 보호할 합리적인 확인 절차나 조건을 제안할 때 사용합니다."
    },
    "finance-credible": {
      "meaning": "관련 근거와 현실적인 판단이 뒷받침되어 믿고 검토할 만하다는 뜻입니다.",
      "usage": "과장 대신 검증 가능한 증거로 제안이나 주장의 신뢰성을 설명할 때 사용합니다."
    },
    "finance-priority": {
      "meaning": "특정 시기나 결정에서 다른 요구보다 더 많은 관심을 두는 목표나 문제입니다.",
      "usage": "고객에게 지금 가장 중요한 성과와 나중에 다룰 개선 사항을 구분할 때 사용합니다."
    },
    "finance-reconcile": {
      "meaning": "수치나 설명, 입장 사이의 차이를 풀어 공통 기준에서 이해할 수 있게 하는 것입니다.",
      "usage": "서로 다른 견적이나 설명이 어떤 전제 차이에서 나왔는지 확인할 때 사용합니다."
    },
    "finance-substantiate": {
      "meaning": "다른 사람이 타당성을 판단할 수 있도록 주장에 충분한 근거를 제시하는 것입니다.",
      "usage": "성능이나 비용 절감, 경쟁 비교에 관한 주장을 뒷받침할 증거를 제시할 때 사용합니다."
    },
    "finance-run-rate": {
      "meaning": "명시한 짧은 기간의 실적 속도가 이어진다고 보고 더 긴 기간의 결과를 추산한 값입니다.",
      "usage": "관측 기간과 유지 조건을 밝히며 단순 연장 추정치를 설명하고 확정 예측처럼 말하지 않습니다."
    },
    "project-prioritise": {
      "meaning": "현재 상황에서 더 중요한 일이나 목표를 먼저 처리하도록 순서를 정하는 것입니다.",
      "usage": "시간이나 도입 역량이 제한되어 고객의 모든 요청을 동시에 수용할 수 없을 때 사용합니다."
    },
    "project-trade-off": {
      "meaning": "한 가지 이점을 더 얻으려면 다른 바람직한 결과의 일부를 포기해야 하는 선택 관계입니다.",
      "usage": "가격·속도·범위 등 서로 충돌하는 이점 중 무엇을 우선할지 고객과 논의할 때 사용합니다."
    },
    "project-dependency": {
      "meaning": "다른 활동이 계획대로 진행되기 위해 먼저 필요한 행동이나 조건입니다.",
      "usage": "약속한 작업이 다른 팀의 조치나 고객 결정, 정보 제공에 달려 있을 때 사용합니다."
    },
    "project-milestone": {
      "meaning": "작업 하나하나가 아니라 중요한 진척을 확인하는 사건이나 결정 시점입니다.",
      "usage": "긴 구매 절차에서 핵심 승인이나 시험 완료 등 중요한 진척 지점을 설명할 때 사용합니다."
    },
    "technology-scalable": {
      "meaning": "노력이나 자원이 감당하기 어려울 정도로 늘지 않아도 사용량이나 적용 범위를 확대할 수 있다는 뜻입니다.",
      "usage": "고객의 확대 계획을 지원할 역량과 추가 검증이 필요한 부분을 논의할 때 사용합니다."
    },
    "sales-qualify": {
      "meaning": "잠재 고객과 영업 기회가 추가 영업 투자를 할 만한 합의된 조건을 충족하는지 평가하는 것입니다.",
      "usage": "구매 필요와 의사결정 절차 등을 확인해 영업 단계와 후속 질문을 정할 때 사용합니다."
    },
    "sales-prospect": {
      "meaning": "필요와 관심을 확인해 향후 영업 대화나 제안을 할 가능성이 있는 잠재 고객입니다.",
      "usage": "기존 고객이나 아직 검토하지 않은 연락처 명단과 구분할 때 사용합니다."
    },
    "sales-value-proposition": {
      "meaning": "특정 고객에게 제안이 어떤 이익을 제공하고 그 이익이 왜 중요한지 명확히 설명한 것입니다.",
      "usage": "제품 특징을 나열하기보다 고객이 중요하다고 밝힌 성과와 연결할 때 사용합니다."
    },
    "sales-objection": {
      "meaning": "제안이나 결정, 행동을 받아들이기 어렵다고 상대방이 밝힌 이유입니다.",
      "usage": "고객의 구체적인 우려를 확인하고 제안을 평가하기 위해 무엇을 더 알아야 할지 논의할 때 사용합니다."
    },
    "sales-conversion": {
      "meaning": "정의한 잠재 고객 집단이 측정한 한 단계에서 특정 다음 단계로 이동하는 것입니다.",
      "usage": "시작 단계와 도착 단계, 측정 기간을 밝혀 영업 전환을 설명할 때 사용합니다."
    },
    "sales-pipeline": {
      "meaning": "구매 결정에 이르는 여러 단계에서 추적 중인 잠재 영업 기회의 집합입니다.",
      "usage": "기회별 단계와 이동 근거를 설명하며 미래 매출 예측치 자체와 구분합니다."
    },
    "sales-retention": {
      "meaning": "정해진 기간 동안 기존 고객과의 관계가 유지되는 것으로 고객 수나 매출 등 측정 기준을 명시합니다.",
      "usage": "첫 구매 이후 고객 관계를 유지하는 활동과 그 결과를 논의할 때 사용합니다."
    },
    "sales-upsell": {
      "meaning": "기존 고객에게 더 높은 등급이나 수량, 서비스 수준으로 구매를 확대하는 판매입니다.",
      "usage": "신규 고객 확보와 구분하고 확인된 추가 필요에 맞는 구매 확대를 논의할 때 사용합니다."
    },
    "operations-fulfilment": {
      "meaning": "고객 주문이나 합의한 요청을 필요한 납품 절차를 통해 이행하는 과정입니다.",
      "usage": "구매 합의가 실제 제공으로 이어지는 흐름과 인수인계 정보를 설명할 때 사용합니다."
    },
    "operations-service-level": {
      "meaning": "합의한 범위 안에서 지원 가능 시간이나 응답 시간 등으로 명시한 서비스 성능 수준입니다.",
      "usage": "제안서에서 확인한 지원 조건이나 성능 기준을 구체적으로 설명할 때 사용합니다."
    },
    "healthcare-escalation": {
      "meaning": "현재 해결하기 어려운 문제를 필요한 권한이나 관점을 가진 사람 또는 협의체에 올리는 것입니다.",
      "usage": "참여자의 결정 권한을 넘거나 현재 정보만으로 해결할 수 없는 문제를 상위에 전달할 때 사용합니다."
    },
    "project-product-scope-creep": {
      "meaning": "영향에 대한 명시적인 합의 없이 요청한 업무가 기존 범위를 넘어 조금씩 늘어나는 현상입니다.",
      "usage": "주로 내부에서 사용하고 고객에게는 추가 요청과 그 영향을 중립적으로 설명합니다."
    },
    "project-product-non-negotiable": {
      "meaning": "확정된 요건이나 분명한 한계 때문에 해당 논의에서 변경할 수 없다는 뜻입니다.",
      "usage": "조정 가능한 선호와 구분해 실제로 양보할 수 없는 조건에만 신중히 사용합니다."
    },
    "project-product-pilot": {
      "meaning": "더 큰 투자를 결정하기 전에 배우기 위해 제품이나 방식을 제한된 범위에서 시험하는 것입니다.",
      "usage": "참여자와 학습 목적, 종료 후 판단 기준이 분명한 시범 도입을 제안할 때 사용합니다."
    },
    "project-product-strategic-fit": {
      "meaning": "기회나 행동이 조직의 방향과 역량, 우선순위에 부합하는 정도입니다.",
      "usage": "매출뿐 아니라 고객 가치와 실행 가능성을 함께 고려해 영업 기회를 평가할 때 사용합니다."
    },
    "sales-business-development-momentum": {
      "meaning": "계속되는 행동이 영업 대화를 앞으로 움직이면서 형성하는 추진력입니다.",
      "usage": "여러 고객 대화에서 시의적절하고 유용한 후속 행동이 필요한 이유를 설명할 때 사용합니다."
    },
    "sales-business-development-buying-signal": {
      "meaning": "구매 관심이 있을 수 있음을 보여 주는 고객의 관찰 가능한 행동입니다.",
      "usage": "구체적인 행동을 근거로 추가 확인을 제안하되 구매 약속으로 단정하지 않습니다."
    },
    "sales-business-development-next-step": {
      "meaning": "대화를 진전시키는 구체적인 다음 행동으로 담당자와 목적, 시기를 정하면 더 명확해집니다.",
      "usage": "통화나 보고를 마칠 때 각자가 무엇을 언제 할지 확인할 때 사용합니다."
    },
    "sales-business-development-stakeholder": {
      "meaning": "제안한 구매의 영향을 받거나 평가와 사용에 영향을 줄 수 있는 사람이나 집단입니다.",
      "usage": "제안에 누구의 요구와 우려, 의견을 반영해야 할지 확인할 때 사용합니다."
    },
    "sales-business-development-decision-maker": {
      "meaning": "고객의 실제 구매 절차에서 특정 결정을 내릴 권한이 있는 사람입니다.",
      "usage": "여러 팀이나 승인 단계가 관여할 때 결정 권한을 정중하게 확인할 때 사용합니다."
    },
    "sales-business-development-follow-up": {
      "meaning": "이전 논의와 연결되어 합의한 행동을 마무리하도록 돕는 후속 연락이나 활동입니다.",
      "usage": "고객이 앞서 요청한 사항과 연결되는 메시지나 회의를 설명할 때 사용합니다."
    },
    "sales-business-development-timeline": {
      "meaning": "활동과 결정이 언제 이루어질지 보여 주는 예상 날짜나 기간의 순서입니다.",
      "usage": "영업과 납품 일정을 정리하면서 불확실한 날짜를 분명히 밝힐 때 사용합니다."
    },
    "sales-business-development-account-context": {
      "meaning": "고객의 목표와 제약, 관계, 이전 논의 등 해당 고객사를 이해하는 데 필요한 배경입니다.",
      "usage": "일반적인 영업 문구보다 그 고객의 상황에 맞게 동료에게 설명할 때 사용합니다."
    },
    "sales-business-development-pain-point": {
      "meaning": "절차 변경이나 구매를 통해 해결할 가치가 있을 수 있는 고객의 구체적인 어려움입니다.",
      "usage": "고객이 이해하고 확인할 수 있는 말로 실제 어려움을 짚는 요구 탐색 단계에서 사용합니다."
    },
    "sales-business-development-differentiator": {
      "meaning": "고객이 검토하는 다른 대안과 제안을 구별해 주는 관련 특징이나 역량, 방식입니다.",
      "usage": "고객의 요구를 기준으로 실제 비교할 수 있는 차이를 설명할 때 사용합니다."
    },
    "sales-business-development-use-case": {
      "meaning": "특정 사용자가 제품이나 서비스를 이용해 정해진 일을 수행하는 구체적인 상황입니다.",
      "usage": "사용자와 활동, 원하는 결과를 제시해 포괄적인 제안을 구체화할 때 사용합니다."
    },
    "sales-business-development-commercial-viability": {
      "meaning": "예상 이익과 비용, 자원, 조건을 고려할 때 거래가 사업적으로 성립할 수 있는지의 여부입니다.",
      "usage": "기술적으로 가능하다는 설명을 넘어 거래 당사자에게 실익이 있는지 논의할 때 사용합니다."
    },
    "sales-business-development-procurement-constraint": {
      "meaning": "조직이 어떻게, 언제, 누구에게 구매할 수 있는지를 제한하는 구매 요건이나 제약입니다.",
      "usage": "고객의 조달 절차를 확인하고 제안이나 일정에 반영할 때 사용합니다."
    },
    "sales-business-development-total-cost-of-ownership": {
      "meaning": "정해진 기간 동안 구매와 사용, 유지, 교체나 종료에 드는 비용을 합한 총보유비용입니다.",
      "usage": "초기 가격만으로는 고객이 필요한 전체 자원을 파악하기 어려울 때 사용합니다."
    },
    "sales-business-development-implementation-scope": {
      "meaning": "구매한 제품이나 서비스를 도입하는 작업에 포함되는 활동과 산출물, 경계입니다.",
      "usage": "견적에 포함된 도입 업무와 별도 논의나 견적이 필요한 업무를 구분할 때 사용합니다."
    },
    "sales-business-development-purchasing-criteria": {
      "meaning": "고객이 제안을 평가하고 구매 적합성을 판단하는 데 사용하는 기준들입니다.",
      "usage": "구매 결정에 실제 영향을 주는 요소와 서로 다른 요구의 중요도를 확인할 때 사용합니다."
    },
    "sales-business-development-indicative": {
      "meaning": "최종 약속을 정하기보다 금액이나 조건의 대략적인 방향을 보여 주기 위한 것이라는 뜻입니다.",
      "usage": "세부 사항을 정하는 중에 초기 견적을 제시하면서 확정 가격과 구분할 때 사용합니다."
    },
    "sales-business-development-contingent": {
      "meaning": "다른 사건이나 조건, 결정이 성립해야 제안한 행동이나 거래가 진행될 수 있다는 뜻입니다.",
      "usage": "제안 조건이나 일정이 무조건 적용될 수 없을 때 필요한 조건을 분명히 밝힙니다."
    },
    "sales-business-development-downside": {
      "meaning": "선택이나 영업상 위험을 받아들일 때 생길 수 있는 불리한 효과나 단점입니다.",
      "usage": "고객이 제안을 받아들일 경우 감수해야 할 손실이나 어려움을 인정할 때 사용합니다."
    },
    "sales-business-development-forecast-confidence": {
      "meaning": "예측을 뒷받침하는 근거의 질과 충실도에 따라 예상 결과를 신뢰할 수 있는 정도입니다.",
      "usage": "담당자의 낙관적인 느낌보다 매출 예측을 뒷받침하는 증거를 논의할 때 사용합니다."
    },
    "sales-business-development-slippage": {
      "meaning": "예상한 날짜나 단계, 목표에서 일정이 지연되거나 벗어나는 것입니다.",
      "usage": "어떤 구매 결정이나 이정표가 밀리는지와 기대를 수정한 이유를 설명할 때 사용합니다."
    },
    "sales-business-development-ambiguity": {
      "meaning": "표현이나 정보에 합리적인 해석이 둘 이상 있어 뜻이 분명하지 않은 상태입니다.",
      "usage": "사람을 탓하기보다 용어와 조건을 명확히 할 필요를 설명할 때 사용합니다."
    },
    "sales-business-development-phased-rollout": {
      "meaning": "모든 사용자나 지역에 한꺼번에 도입하지 않고 계획한 단계에 따라 나누어 도입하는 것입니다.",
      "usage": "고객의 준비 정도와 지원 역량에 맞추거나 확대 근거를 모으려 할 때 사용합니다."
    },
    "sales-business-development-reservation": {
      "meaning": "추가 정보나 안심할 근거 없이는 제안을 받아들이기 어렵게 하는 의구심이나 우려입니다.",
      "usage": "명시적인 거절보다는 조심스러운 주저함을 인정하고 확인할 때 사용합니다."
    },
    "sales-business-development-pushback": {
      "meaning": "제안이나 요청, 예정한 행동에 대해 표현한 저항이나 반대입니다.",
      "usage": "주로 내부에서 반대의 내용을 설명하며 고객과 사용할 때는 비난하는 어조를 피합니다."
    },
    "sales-business-development-acknowledge": {
      "meaning": "상대의 의견이나 우려, 경험을 명시적으로 인정하되 모든 결론에 동의한다는 뜻은 아닙니다.",
      "usage": "고객의 우려에 답하거나 반론하기 전에 핵심을 들었다는 점을 보여 줄 때 사용합니다."
    },
    "sales-business-development-reframe": {
      "meaning": "문제나 선택을 더 유용한 다른 관점에서 제시해 명확히 검토하도록 하는 것입니다.",
      "usage": "현재의 표현이 고객의 실제 결정을 가릴 때 선택의 득실이 드러나도록 관점을 바꿉니다."
    },
    "sales-business-development-concede": {
      "meaning": "특정 의견이 타당하거나 요청한 조정이 적절할 수 있음을 인정하는 것입니다.",
      "usage": "일리 있는 지점을 솔직히 인정하면서 나머지 비교는 정확하게 이어 갈 때 사용합니다."
    },
    "sales-business-development-calibrate": {
      "meaning": "근거와 상황에 맞게 접근 방식이나 기대 수준, 설명의 정도를 세심하게 조정하는 것입니다.",
      "usage": "고객에게 맞는 제안의 규모나 어조, 확신의 정도를 정할 때 사용합니다."
    },
    "sales-business-development-misalignment": {
      "meaning": "참여자의 기대나 목표, 이해가 서로 달라 조율이나 합의가 어려울 수 있는 상태입니다.",
      "usage": "불일치를 중립적으로 설명하고 진행 전에 공통 이해를 만들도록 제안할 때 사용합니다."
    },
    "sales-business-development-disproportionate": {
      "meaning": "검토하는 문제나 이익, 위험, 근거에 비해 크기나 정도가 지나치거나 부족하다는 뜻입니다.",
      "usage": "요청이나 대응의 규모가 실제 문제에 비례하는지 논의할 때 사용합니다."
    },
    "sales-business-development-impasse": {
      "meaning": "현재 서로 수용할 수 있는 방안을 찾지 못해 논의가 더 진행되지 않는 교착 상태입니다.",
      "usage": "단순한 이견과 구분해 협상이 멈춘 지점과 다시 검토할 선택지를 설명할 때 사용합니다."
    },
    "sales-business-development-propose": {
      "meaning": "관계자들이 검토하고 논의하거나 합의하도록 선택지나 행동을 제시하는 것입니다.",
      "usage": "아직 합의되지 않은 제안을 다음 단계나 조건으로 내놓을 때 사용합니다."
    },
    "sales-business-development-compelling": {
      "meaning": "이유나 근거, 관련성이 강해 진지하게 검토하거나 행동을 고려할 만하다는 뜻입니다.",
      "usage": "고객의 실제 요구에 비추어 제안이 설득력 있는 이유를 설명할 때 사용합니다."
    },
    "sales-business-development-concession": {
      "meaning": "협상에서 한쪽이 특정 요청 등에 대응해 제공하기로 동의한 조건 조정이나 혜택입니다.",
      "usage": "가격이나 범위를 양보할 때 제공 내용과 그 조건을 명확히 말할 때 사용합니다."
    },
    "sales-business-development-reciprocity": {
      "meaning": "상대가 제공한 것에 대응해 각자가 의미 있는 것을 내놓는 상호 교환입니다.",
      "usage": "협상에서 한쪽의 양보에 대해 다른 쪽이 무엇을 제공할지 논의할 때 사용합니다."
    },
    "sales-business-development-conditional-offer": {
      "meaning": "명시한 조건을 충족하고 필요한 승인을 얻어야 적용되는 제안입니다.",
      "usage": "거래 조건을 제시하면서 성립 요건과 승인 여부를 함께 밝힐 때 사용합니다."
    },
    "sales-business-development-close-plan": {
      "meaning": "영업 기회의 구매 여부를 명확히 결정하기 위해 남은 행동과 결정을 함께 정리한 계획입니다.",
      "usage": "계약 체결을 확정된 일처럼 말하지 않고 남은 구매 절차를 고객과 정리할 때 사용합니다."
    },
    "sales-business-development-account-strategy": {
      "meaning": "고객의 우선순위와 상호 가치, 현실적인 거래 가능성에 맞춰 관계를 발전시키는 계획적인 접근입니다.",
      "usage": "한 건의 판매를 넘어 고객사와의 관계를 어떻게 키울지 논의할 때 사용합니다."
    },
    "sales-business-development-mutual-action-plan": {
      "meaning": "공급자와 고객 양쪽의 행동과 담당자, 결정 시점을 함께 합의한 계획입니다.",
      "usage": "각 당사자가 해야 할 일과 중요한 판단 지점을 명확히 공유할 때 사용합니다."
    },
    "sales-business-development-commercial-discipline": {
      "meaning": "매출을 추구하면서 근거와 실행 가능한 조건, 납품 역량, 책임 있는 판단을 일관되게 살피는 태도입니다.",
      "usage": "무리한 매출 약속보다 지속 가능한 계약 조건과 제공 역량을 지킬 때 사용합니다."
    },
    "sales-business-development-executive-alignment": {
      "meaning": "중요한 성과와 우선순위, 결정에 대해 고위 관계자들이 공통으로 이해하는 상태입니다.",
      "usage": "경영진의 구체적인 합의 사항을 확인하며 막연한 지지와 구분할 때 사용합니다."
    },
    "sales-business-development-mandate": {
      "meaning": "정해진 목표를 추진하거나 특정 결정을 내리도록 사람이나 집단에 부여한 권한과 범위입니다.",
      "usage": "영업 담당자나 후원자가 무엇을 결정할 수 있는지 확인할 때 사용합니다."
    },
    "sales-business-development-stewardship": {
      "meaning": "맡겨진 자원과 약속, 관계를 장기적으로 책임 있게 돌보고 관리하는 것입니다.",
      "usage": "즉각적인 매출을 넘어 고객 신뢰와 약속을 지속적으로 지키는 책임을 설명할 때 사용합니다."
    },
    "sales-business-development-sustainable": {
      "meaning": "자원이나 요구, 조건이 감당할 수 없는 수준이 되지 않으면서 계속 유지할 수 있다는 뜻입니다.",
      "usage": "거래 조건과 고객 지원이 장기적으로 지속 가능한지 논의하며 환경적 의미인지도 구분합니다."
    },
    "sales-business-development-mobilise": {
      "meaning": "공통 목표를 향해 효과적으로 행동하도록 사람과 전문성, 자원을 모으는 것입니다.",
      "usage": "합의한 고객 목표를 실행하기 위해 필요한 팀과 지원을 조직할 때 사용합니다."
    },
    "sales-business-development-recalibrate": {
      "meaning": "새로운 근거에 비추어 기존 기대나 목표, 접근 방식이 맞지 않을 때 다시 조정하는 것입니다.",
      "usage": "예측이나 영업 계획을 수정하면서 무엇을 새로 알게 되었는지 설명할 때 사용합니다."
    },
    "sales-business-development-deliberate": {
      "meaning": "우연이나 무심한 습관이 아니라 목적과 대안을 검토해 의식적으로 선택한 것이라는 뜻입니다.",
      "usage": "영업 방향이나 관계 관리 방식을 왜 계획적으로 선택했는지 설명할 때 사용합니다."
    }
  },
  "people-human-resources": {
    "finance-discrepancy": {
      "meaning": "설명이나 기록, 기대 사이에 있어 결론을 내리기 전에 확인해야 할 차이입니다.",
      "usage": "사람의 설명이나 기록이 다를 때 부정직함이나 잘못으로 단정하지 않고 사용합니다."
    },
    "finance-provisional": {
      "meaning": "추가 정보에 따라 수정할 수 있도록 현재는 잠정적으로 채택하거나 제안한 상태입니다.",
      "usage": "업무상 임시 해석이나 권고를 공유할 때 최종 판단이 아니라는 점을 밝힙니다."
    },
    "finance-consistent": {
      "meaning": "비교할 만한 상황에 일관된 방식이나 기준을 적용하고 달리 다루는 이유를 명확히 한다는 뜻입니다.",
      "usage": "관리자들이 공통된 소통 절차나 업무 논의 기준을 적용하도록 도울 때 사용합니다."
    },
    "finance-handover": {
      "meaning": "업무와 관련 정보, 책임을 한 사람이나 팀에서 다른 사람이나 팀으로 넘기는 인수인계입니다.",
      "usage": "새 담당자가 혼란 없이 업무를 이어 가는 데 필요한 배경과 정보를 논의할 때 사용합니다."
    },
    "finance-proportionate": {
      "meaning": "문제와 근거, 상황에 비추어 대응의 규모나 강도가 지나치거나 부족하지 않고 적절하다는 뜻입니다.",
      "usage": "현재 확인된 내용에 맞는 소통 방식을 논의하며 공식 징계 판단을 뜻하는 말로 쓰지 않습니다."
    },
    "finance-baseline": {
      "meaning": "이후 관찰이나 변화를 비교하기 위해 명시해 두는 최초의 값이나 기준입니다.",
      "usage": "인사 지표의 변화를 무엇과 비교하며 같은 기준으로 측정했는지 설명할 때 사용합니다."
    },
    "finance-corroborate": {
      "meaning": "다른 관찰이나 적절한 출처의 추가 정보로 설명이나 해석을 뒷받침하는 것입니다.",
      "usage": "한 번의 인상이나 진술에만 의존하지 않고 중요한 해석을 추가로 확인할 때 사용합니다."
    },
    "finance-accountability": {
      "meaning": "특정 결과나 결정에 대해 진행을 설명하고 자신의 권한 안에서 문제를 해결해야 하는 책임입니다.",
      "usage": "행동할 권한과 책임을 맞추고 진행 상황이나 문제를 어떻게 설명할지 정할 때 사용합니다."
    },
    "finance-transparent": {
      "meaning": "관계자가 결정에 이른 이유와 정보, 절차를 이해할 수 있도록 명확하다는 뜻입니다.",
      "usage": "개인정보 공개의 정당한 한계를 지키면서 인사 절차를 알기 쉽게 설명할 때 사용합니다."
    },
    "finance-rationale": {
      "meaning": "제안한 행동이나 결정이 해당 문제와 상황에 맞는 이유입니다.",
      "usage": "지원 방안이나 학습 활동, 소통 방식의 변경을 제안한 이유를 설명할 때 사용합니다."
    },
    "finance-recommend": {
      "meaning": "목적과 근거, 상황에 적합한 이유를 설명하면서 특정 행동을 권하는 것입니다.",
      "usage": "관찰에서 구체적인 지원 제안으로 나아가고 당사자의 필요에 맞는지 논의할 때 사용합니다."
    },
    "finance-feasible": {
      "meaning": "시간과 자원, 책임 등 실제 제약을 고려해 실행할 수 있다는 뜻입니다.",
      "usage": "역량 개발이나 지원 제안을 현실적으로 실행할 수 있는지 확인할 때 사용합니다."
    },
    "finance-caveat": {
      "meaning": "진술이나 조사 결과, 권고를 정확히 이해하는 데 필요한 단서나 한계입니다.",
      "usage": "인사 관련 결과나 제안의 해석을 바꿀 수 있는 중요한 제한 사항을 설명할 때 사용합니다."
    },
    "finance-perspective": {
      "meaning": "정보와 경험, 책임, 처한 위치에 따라 사람이 상황을 이해하는 관점입니다.",
      "usage": "어느 한 사람의 설명만으로 모든 사실을 알 수 있다고 가정하지 않고 여러 의견을 들을 때 사용합니다."
    },
    "finance-safeguard": {
      "meaning": "제안한 행동에서 예상되는 특정 문제를 줄이기 위한 실질적인 확인 절차나 장치입니다.",
      "usage": "지원이나 변화 계획의 부작용을 발견하거나 줄이는 적절한 장치를 제안할 때 사용합니다."
    },
    "finance-evaluate": {
      "meaning": "명시한 질문이나 기준에 따라 정보를 검토해 방식의 유용성이나 질, 효과를 판단하는 것입니다.",
      "usage": "정성적 근거도 고려하면서 인사 활동이나 학습 활동을 어떻게 검토할지 설명할 때 사용합니다."
    },
    "finance-substantiate": {
      "meaning": "다른 사람이 검토하고 답할 수 있도록 중요한 주장이나 해석에 관련 근거를 제시하는 것입니다.",
      "usage": "평가나 비판이 지나치게 포괄적일 때 공정한 논의에 필요한 구체적 사례를 요청할 때 사용합니다."
    },
    "project-prioritise": {
      "meaning": "시간이나 지원, 자원이 제한될 때 먼저 다룰 필요나 활동을 정하는 것입니다.",
      "usage": "모든 개선 요구를 똑같이 시급하게 다루기보다 감당할 수 있는 순서를 정할 때 사용합니다."
    },
    "project-trade-off": {
      "meaning": "한 가지 원하는 결과를 개선하면서 다른 결과에서 비용이나 한계를 받아들여야 하는 선택 관계입니다.",
      "usage": "인사 제안이 여러 정당한 필요에 영향을 줄 때 각 선택이 포기하는 부분을 설명합니다."
    },
    "sales-retention": {
      "meaning": "정해진 기간 동안 사람들이 고용이나 참여를 계속 유지하는 것으로 대상 집단과 측정 기준을 명시합니다.",
      "usage": "직원이 조직에 남아 있는 양상과 그 이유를 더 잘 이해하기 위한 정보를 논의할 때 사용합니다."
    },
    "people-onboarding": {
      "meaning": "새 조직이나 직무, 팀, 업무 자원에 익숙해져 기여할 수 있도록 돕는 적응 과정입니다.",
      "usage": "새로운 환경에서 일하는 방식을 이해하도록 실무적·관계적 지원을 설명할 때 사용합니다."
    },
    "people-attrition": {
      "meaning": "정의한 대상과 기간 안에 사람들이 떠나면서 인력이 줄어드는 현상입니다.",
      "usage": "인력 감소 추이를 말할 때 계산 기준과 대상 집단을 밝히고 원인을 섣불리 추측하지 않습니다."
    },
    "people-psychological-safety": {
      "meaning": "질문이나 우려, 실수, 반대 의견을 내도 모욕이나 대인관계상의 불이익을 받지 않으리라는 팀의 공통된 믿음입니다.",
      "usage": "팀원이 목소리를 낼 수 있는 환경을 논의하며 실제 경험을 확인할 때 사용합니다."
    },
    "people-equitable": {
      "meaning": "모두를 똑같이 대하기보다 관련된 필요와 접근 기회의 차이를 고려해 상황에 맞게 공정하다는 뜻입니다.",
      "usage": "지원 방식의 차이가 왜 공정한지 관련 사정을 들어 설명할 때 사용합니다."
    },
    "people-mediate": {
      "meaning": "의견이 다른 사람들이 소통하고 문제를 이해하며 해결책을 찾도록 돕는 중재입니다.",
      "usage": "자신의 답을 강요하기보다 권한의 한계를 밝히고 직장 내 대화를 돕는 역할을 설명할 때 사용합니다."
    },
    "people-developmental-feedback": {
      "meaning": "구체적인 관찰과 성찰을 통해 기술이나 일하는 방식을 발전시키도록 돕는 피드백입니다.",
      "usage": "사람이 배우고 개선하도록 관찰한 행동과 그 영향을 명확히 설명할 때 사용합니다."
    },
    "people-succession-planning": {
      "meaning": "중요한 역할을 앞으로 누가 맡을 수 있을지와 그 연속성에 필요한 역량 개발을 검토하는 후계 인재 계획입니다.",
      "usage": "장기적인 업무 연속성과 인재 육성을 논의하며 특정 개인의 승진을 보장하는 말로 쓰지 않습니다."
    },
    "people-engagement": {
      "meaning": "일이나 조직에 대한 사람들의 참여와 관심, 유대감으로 명확한 근거를 통해 이해해야 합니다.",
      "usage": "설문 지표나 구체적인 참여 행동을 바탕으로 조직과의 연결 정도를 논의할 때 사용합니다."
    },
    "consulting-actionable": {
      "meaning": "상대방이 실제로 취할 유용한 행동을 정할 수 있을 만큼 명확하고 실용적이라는 뜻입니다.",
      "usage": "개발 제안이 동료가 논의하고 연습할 구체적인 행동으로 이어지는지 검토할 때 사용합니다."
    },
    "consulting-operating-model": {
      "meaning": "직원과 관리자를 지원하기 위해 인사 기능의 책임과 서비스, 절차, 인수인계를 구성하는 방식입니다.",
      "usage": "조직 변화가 지원 접근 방법과 담당 책임, 인사 서비스 간 협업에 미치는 영향을 설명할 때 사용합니다."
    },
    "operations-capacity": {
      "meaning": "현재 업무와 가용 시간, 자원, 기술을 고려했을 때 추가 일을 맡을 수 있는 실질적인 여력입니다.",
      "usage": "새 요청을 수용할 수 있는지와 이를 위해 무엇이 달라져야 하는지 논의할 때 사용합니다."
    },
    "project-product-decision-rights": {
      "meaning": "조언이나 실행 책임과 구분하여 특정 결정을 내리도록 합의한 권한입니다.",
      "usage": "책임이 겹쳐 누가 승인하고 제안하며 의견을 낼 수 있는지 불분명할 때 사용합니다."
    },
    "project-product-pilot": {
      "meaning": "접근 방식을 확대할지 판단하기 전에 배우기 위해 제한된 범위에서 하는 초기 시험입니다.",
      "usage": "인사 제도를 정해진 기간에 시험하고 이후의 결정을 명확히 할 때 사용합니다."
    },
    "sales-business-development-indicative": {
      "meaning": "초기 방향이나 가능성은 보여 주지만 최종 결론이나 폭넓은 일반화를 뒷받침하기에는 아직 부족하다는 뜻입니다.",
      "usage": "예비 인사 자료로 다음 질문을 정하면서 범위와 불확실성을 함께 밝힐 때 사용합니다."
    },
    "sales-business-development-acknowledge": {
      "meaning": "상대가 자신의 우려나 경험, 관련 사실이 전달되고 고려되었다고 알 수 있도록 명시적으로 인정하는 것입니다.",
      "usage": "어려운 대화의 초기에 설명이나 해결책을 논의하기 전에 상대가 제기한 핵심을 받아들일 때 사용합니다."
    },
    "sales-business-development-mandate": {
      "meaning": "업무를 수행하거나 특정 결정을 내리도록 사람이나 집단에 부여한 목적과 권한입니다.",
      "usage": "여러 팀에 걸친 역할에서 맡은 일과 허용된 결정 범위를 설명할 때 사용합니다."
    },
    "sales-business-development-stewardship": {
      "meaning": "리더나 팀에 맡겨진 인사 관련 약속과 자원, 신뢰를 장기적으로 책임 있게 돌보는 것입니다.",
      "usage": "인사 활동을 발표하는 데 그치지 않고 후속 조치와 학습까지 책임지는 리더십을 설명할 때 사용합니다."
    },
    "sales-business-development-recalibrate": {
      "meaning": "새로운 근거나 상황에 따라 기존 판단이나 기대, 방식을 다시 조정하는 것입니다.",
      "usage": "인사 활동을 수정하면서 어떤 증거가 처음의 이해를 바꾸었는지 설명할 때 사용합니다."
    },
    "operations-supply-chain-interdependence": {
      "meaning": "자신의 성과를 내기 위해 사람이나 팀이 서로의 업무와 정보, 결정에 의존하는 관계입니다.",
      "usage": "팀의 문제를 한 개인의 행동이나 업무량만으로 설명할 수 없는 이유를 말할 때 사용합니다."
    },
    "technology-engineering-correlation": {
      "meaning": "두 가지가 함께 변하는 것으로 관찰된 연관성이며 이것만으로 원인 관계를 입증하지는 못합니다.",
      "usage": "인사 데이터의 관련 양상을 근거 없는 인과 설명으로 바꾸지 않도록 신중히 표현할 때 사용합니다."
    },
    "people-human-resources-expectation": {
      "meaning": "어떤 일을 하고 어떻게 처리하며 어떤 결과를 낼지에 대해 명시한 기대나 이해입니다.",
      "usage": "성과 대화의 기준이나 합의를 명확히 하고 서로 확인할 수 있게 할 때 사용합니다."
    },
    "people-human-resources-observation": {
      "meaning": "의미나 동기에 대한 해석과 구분되는, 실제로 보거나 기록한 구체적인 내용입니다.",
      "usage": "피드백을 확인 가능한 사건에 근거해 제시하고 상대의 배경 설명을 들을 때 사용합니다."
    },
    "people-human-resources-workload": {
      "meaning": "특정 기간에 맡도록 기대되는 업무의 양과 성격입니다.",
      "usage": "업무 수뿐 아니라 복잡성이나 기한, 지원을 함께 고려해 부담을 논의할 때 사용합니다."
    },
    "people-human-resources-participation": {
      "meaning": "누가 어떻게 참여했는지를 분명히 하여 활동이나 절차에 함께하는 것입니다.",
      "usage": "피드백이나 의견 수렴에 기여한 사람과 빠져 있는 관점을 설명할 때 사용합니다."
    },
    "people-human-resources-response-rate": {
      "meaning": "명확히 정한 활동에서 응답을 요청받은 사람 중 실제로 응답한 사람의 비율입니다.",
      "usage": "설문이나 의견 수렴 결과를 발표할 때 초대받은 집단 중 얼마나 참여했는지 밝힐 때 사용합니다."
    },
    "people-human-resources-vacancy": {
      "meaning": "현재 담당자가 없어 업무 책임과 충원 방식을 파악할 필요가 있는 빈 자리입니다.",
      "usage": "비어 있는 직무가 팀에 미치는 실제 영향을 설명하며 채용 결정을 추측하지 않습니다."
    },
    "people-human-resources-continuity": {
      "meaning": "사람이나 방식, 상황이 바뀌어도 중요한 업무나 관계가 일관되게 이어질 수 있는 상태입니다.",
      "usage": "지식과 필수 업무를 유지하기 위한 인수인계나 임시 조치를 논의할 때 사용합니다."
    },
    "people-human-resources-competency": {
      "meaning": "특정 업무 수행에 필요한 기술과 지식, 행동을 정의한 역량입니다.",
      "usage": "면접이나 개발 대화를 해당 업무에 필요한 구체적 역량과 연결할 때 사용합니다."
    },
    "people-human-resources-behavioural-evidence": {
      "meaning": "특정 상황에서 실제로 한 행동을 보여 주어 기술이나 업무 방식을 검토하는 데 쓰는 구체적 정보입니다.",
      "usage": "성격에 대한 인상이나 포괄적인 자기소개와 실제 행동 사례를 구분할 때 사용합니다."
    },
    "people-human-resources-structured-interview": {
      "meaning": "직무와 관련된 질문을 미리 정하고 답변 근거를 논의할 방식을 명시해 진행하는 구조화 면접입니다.",
      "usage": "면접 진행 방식과 답변을 관련 평가 기준에 연결하는 방법을 설명할 때 사용합니다."
    },
    "people-human-resources-specific": {
      "meaning": "막연한 평가 대신 어떤 행동이나 시점, 문제, 결과를 말하는지 알 수 있을 만큼 구체적이라는 뜻입니다.",
      "usage": "피드백이나 면접 답변의 실제 내용을 이해하고 대응할 수 있는 세부 사항을 요청할 때 사용합니다."
    },
    "people-human-resources-measurable": {
      "meaning": "질문에 맞는 명시적 측정 방법이나 관찰 기준으로 평가할 수 있다는 뜻입니다.",
      "usage": "개발 과정의 진전을 어떻게 확인할지 정할 때 쓰며 반드시 숫자 점수를 뜻하지는 않습니다."
    },
    "people-human-resources-role-clarity": {
      "meaning": "책임과 기대 기여, 협업 관계, 권한의 한계에 대해 함께 이해하는 역할 명확성입니다.",
      "usage": "팀 변경이나 새 과제 이후 담당 책임과 기대가 불분명할 때 사용합니다."
    },
    "people-human-resources-operating-rhythm": {
      "meaning": "팀이 업무를 조율하도록 반복적으로 운영하는 회의와 보고, 결정의 주기입니다.",
      "usage": "정기 소통의 목적과 각 시점에서 다룰 정보나 결정을 설명할 때 사용합니다."
    },
    "people-human-resources-distinguish": {
      "meaning": "혼동하거나 같게 취급할 수 있는 것들 사이의 차이를 알아보고 설명하는 것입니다.",
      "usage": "면접이나 피드백에서 서로 다른 종류의 정보를 나누어 검토할 때 사용합니다."
    },
    "people-human-resources-contextualise": {
      "meaning": "정보를 관련 상황 속에 놓아 그 의미와 한계를 더 정확히 이해하도록 하는 것입니다.",
      "usage": "시기나 자원, 역할 기대, 업무 조건 없이는 근거를 잘못 해석할 수 있을 때 사용합니다."
    },
    "people-human-resources-inference": {
      "meaning": "직접 관찰하거나 확립한 사실이 아니라 주어진 정보에서 추론해 이끌어 낸 결론입니다.",
      "usage": "관찰 내용에서 가능한 해석으로 이어지는 사고 과정을 설명할 때 사용합니다."
    },
    "people-human-resources-causation": {
      "meaning": "한 요인이 결과를 만들어 내는 데 기여하는 관계로 단순한 연관성이나 시간 순서보다 더 많은 근거가 필요합니다.",
      "usage": "특정 활동이 인사 성과를 발생시켰다고 말할 증거가 있는지 검토할 때 사용합니다."
    },
    "people-human-resources-representativeness": {
      "meaning": "참여한 사람이나 관찰 내용이 질문과 관련된 전체 집단을 반영하는 정도입니다.",
      "usage": "참여자의 결과를 참여하지 않은 사람들에게 어디까지 적용할 수 있을지 검토할 때 사용합니다."
    },
    "people-human-resources-selection-bias": {
      "meaning": "참여자나 관찰 대상을 고르는 방식 때문에 대상 집단이 전체 집단과 체계적으로 달라져 생기는 왜곡입니다.",
      "usage": "참여나 선정 방식이 인사 조사에서 내리는 결론에 미치는 영향을 설명할 때 사용합니다."
    },
    "people-human-resources-confounding-factor": {
      "meaning": "설명하려는 요인과 결과 양쪽에 관련되어 두 요인의 관계를 잘못 해석하게 할 수 있는 교란 요인입니다.",
      "usage": "관찰한 차이를 한 활동의 효과로 돌리기 전에 다른 관련 차이가 있는지 검토할 때 사용합니다."
    },
    "people-human-resources-plausible": {
      "meaning": "확립된 설명은 아니지만 주어진 정보에 비추어 검토할 만한 타당성이 있다는 뜻입니다.",
      "usage": "가능한 설명을 제시하면서 증거가 허용하는 정도 이상으로 확신하지 않을 때 사용합니다."
    },
    "people-human-resources-uncertainty": {
      "meaning": "관련 사실이나 해석, 미래 결과를 충분히 확신할 만큼 아직 알지 못하는 정도입니다.",
      "usage": "정보의 한계를 밝히면서도 책임 있게 논의하거나 실행할 수 있는 일을 설명할 때 사용합니다."
    },
    "people-human-resources-counterfactual": {
      "meaning": "특정 사건이나 조치가 없었다면 어떤 일이 일어났을지 비교를 위해 검토하는 가정입니다.",
      "usage": "개선된 결과를 특정 조치의 효과라고 볼 수 있는지 비교 기준을 따져 볼 때 사용합니다."
    },
    "people-human-resources-competing-priorities": {
      "meaning": "현재 조건에서 같은 관심과 자원, 시간을 동시에 배정할 수 없는 중요한 요구들입니다.",
      "usage": "막연한 업무 부담을 넘어 무엇의 순서를 바꾸고 어디에 지원할지 논의할 때 사용합니다."
    },
    "people-human-resources-unintended-consequence": {
      "meaning": "행동의 원래 목적에 포함되지 않았던 결과로 유익하거나 해롭거나 두 성격이 함께 있을 수 있습니다.",
      "usage": "제안의 이익 외에도 누구에게 다른 영향이 생길지 검토할 때 사용합니다."
    },
    "people-human-resources-de-escalate": {
      "meaning": "이견이나 갈등의 긴장과 강도를 낮춰 더 차분하고 건설적으로 소통하게 하는 것입니다.",
      "usage": "긴장된 대화에서 속도나 어조, 진행 방식을 조정할 때 사용합니다."
    },
    "people-human-resources-candour": {
      "meaning": "다른 사람을 배려하면서도 관련 생각과 우려, 정보를 솔직하고 직접적으로 전하는 것입니다.",
      "usage": "도움이 되는 솔직함을 장려하고 직접적인 피드백도 검토하겠다는 뜻을 보일 때 사용합니다."
    },
    "people-human-resources-defensiveness": {
      "meaning": "비판받는다고 느껴 자신을 보호하려는 반응으로 피드백을 듣고 살피기 어렵게 만들 수 있습니다.",
      "usage": "사람을 단정적으로 평가하기보다 대화에 영향을 주는 구체적 행동이나 자신의 반응을 돌아볼 때 사용합니다."
    },
    "people-human-resources-generalisation": {
      "meaning": "특정 사례를 넘어 사람이나 집단, 반복되는 양상 전체로 넓혀 말하는 일반화입니다.",
      "usage": "넓은 꼬리표가 실제 문제를 가릴 때 구체적 관찰이나 적용 한계를 확인할 때 사용합니다."
    },
    "people-human-resources-intent": {
      "meaning": "말하거나 행동할 때 당사자가 품었던 목적으로 실제로 다른 사람에게 준 영향과 다를 수 있습니다.",
      "usage": "행동의 목적을 설명하면서 상대가 받은 영향도 함께 살필 여지를 만들 때 사용합니다."
    },
    "people-human-resources-impact": {
      "meaning": "행동이나 결정, 소통이 해당 상황의 사람과 업무, 관계에 미친 영향입니다.",
      "usage": "막연한 평가 대신 문제가 중요한 이유인 실제 업무상·관계상 효과를 설명할 때 사용합니다."
    },
    "people-human-resources-boundary": {
      "meaning": "무엇이 적절하거나 가능하고 누구의 책임에 속하는지 알려 주는 분명한 한계입니다.",
      "usage": "건설적인 대화의 조건이나 자신의 역할, 이용 가능한 정보의 한계를 밝힐 때 사용합니다."
    },
    "people-human-resources-respectful-dissent": {
      "meaning": "사람을 존중하면서 생각이나 결정, 근거에 대해 분명히 다른 의견을 밝히는 것입니다.",
      "usage": "분위기를 위해 동의하도록 요구하기보다 제안을 검토하고 우려를 말하도록 권할 때 사용합니다."
    },
    "people-human-resources-development-objective": {
      "meaning": "연습과 성찰을 통해 강화하려는 역량이나 일하는 방식을 구체적으로 정한 개발 목표입니다.",
      "usage": "막연히 더 잘하겠다는 바람보다 이해할 수 있는 기술에 학습 대화를 집중할 때 사용합니다."
    },
    "people-human-resources-stretch-assignment": {
      "meaning": "적절한 지원 아래 기존 경험을 넘어서는 도전을 하며 배울 수 있는 업무 과제입니다.",
      "usage": "업무를 통한 학습을 제안하며 도전 수준과 지원, 한계를 함께 논의할 때 사용합니다."
    },
    "people-human-resources-coaching": {
      "meaning": "성찰과 목표 명확화, 선택 탐색을 통해 유용한 행동이나 연습을 찾도록 돕는 개발 대화입니다.",
      "usage": "일방적인 지시나 인물 평가보다 질문과 성찰, 연습을 통해 성장을 지원할 때 사용합니다."
    },
    "people-human-resources-intervention": {
      "meaning": "검토 가능한 목적을 두고 상황이나 결과에 영향을 주기 위해 의도적으로 도입한 조치입니다.",
      "usage": "특정 변화의 의도한 효과를 설명하고 실제로 도움이 되었는지 검토할 때 사용합니다."
    },
    "people-human-resources-tailored-support": {
      "meaning": "누구에게나 동일하게 제공하기보다 개인의 필요와 목표, 상황에 맞게 조정한 지원입니다.",
      "usage": "업무나 학습을 개인에게 더 유용하고 접근하기 쉽게 만드는 방안을 논의할 때 사용합니다."
    },
    "people-human-resources-flexibility": {
      "meaning": "여전히 적용되는 제약을 인정하면서도 필요한 상황에 맞게 방식이나 합의를 조정할 여지입니다.",
      "usage": "근무 조건의 모든 부분을 바꿀 수 있다고 가정하지 않고 가능한 조정을 탐색할 때 사용합니다."
    },
    "people-human-resources-individual-circumstances": {
      "meaning": "특정인의 필요와 선택, 경험을 이해하는 데 관련이 있는 개인별 상황이나 조건입니다.",
      "usage": "같은 절차도 사람마다 다르게 작용할 수 있음을 인정하며 정중히 배경을 들을 때 사용합니다."
    },
    "people-human-resources-review-point": {
      "meaning": "진행과 근거를 다시 살펴보고 기존 계획을 유지할지 바꿀지 논의하기로 합의한 시점입니다.",
      "usage": "지원 제안을 일회성 지시로 끝내지 않고 계속 확인하고 배우는 대화로 연결할 때 사용합니다."
    },
    "people-human-resources-organisational-change": {
      "meaning": "조직의 구조와 절차, 우선순위, 업무 방식이 바뀌어 사람들이 역할을 이해하고 수행하는 데 영향을 주는 변화입니다.",
      "usage": "무엇이 왜 바뀌고 무엇이 유지되며 아직 결정하지 않은 것은 무엇인지 설명할 때 사용합니다."
    },
    "people-human-resources-consultation": {
      "meaning": "실제로 의견을 반영할 여지가 있는 사안에 대해 관련 의견을 구하고 검토하는 과정입니다.",
      "usage": "사람들이 어떤 부분에 영향을 줄 수 있고 의견을 어떻게 검토해 답할지 밝힐 때 사용합니다."
    },
    "people-human-resources-sensemaking": {
      "meaning": "정보를 함께 해석해 무엇이 일어나고 어떤 의미가 있는지 이해할 수 있는 설명으로 연결하는 과정입니다.",
      "usage": "변화나 낯선 상황에서 사실만으로는 실무적인 궁금증을 풀기 어려울 때 사용합니다."
    },
    "people-human-resources-knowledge-transfer": {
      "meaning": "다른 사람도 중요한 정보를 활용하거나 업무를 할 수 있도록 실질적인 이해를 나누고 발전시키는 지식 이전입니다.",
      "usage": "특정 개인이나 팀에 집중된 지식을 공유해 업무 연속성과 학습을 계획할 때 사용합니다."
    },
    "people-human-resources-bench-strength": {
      "meaning": "적절한 준비와 지원을 거치면 중요한 책임을 맡을 수 있는 인재가 얼마나 두텁게 확보되어 있는지를 뜻합니다.",
      "usage": "주로 리더십의 인재 확보 논의에서 사용하고 실제 필요한 업무와 지원으로 풀어 설명합니다."
    },
    "people-human-resources-inclusion": {
      "meaning": "사람들이 참여하고 기여하며 자신의 관련 관점이 고려된다고 느끼도록 하는 실천과 경험입니다.",
      "usage": "모두가 같은 경험을 한다고 가정하지 않고 참여와 접근 기회를 구체적으로 논의할 때 사용합니다."
    },
    "people-human-resources-procedural-fairness": {
      "meaning": "이해할 수 있는 기준과 의견 제시 기회, 명확한 설명 등 결정을 내리는 과정의 공정성입니다.",
      "usage": "원하는 결과를 얻었는지와 구분해 의사결정 과정과 소통이 공정했는지 논의할 때 사용합니다."
    },
    "people-human-resources-sustain": {
      "meaning": "적절한 관심과 자원, 조정을 통해 유용한 활동이나 역량, 양상을 장기적으로 유지하는 것입니다.",
      "usage": "초기 교육이나 도입이 끝난 후에도 유용한 변화를 이어 가는 데 필요한 조건을 논의할 때 사용합니다."
    },
    "people-human-resources-collective-ownership": {
      "meaning": "결과를 만들고 지지할 책임을 함께 느끼되 구체적인 결정과 행동의 담당자는 분명히 두는 공동 책임 의식입니다.",
      "usage": "개선에 사람들을 참여시키고 각자의 기여가 공동 결과에 어떻게 연결되는지 설명할 때 사용합니다."
    }
  },
  "consulting-strategy": {
    "finance-discrepancy": {
      "meaning": "서로 일관된 근거로 보기 전에 설명이 필요한 수치나 설명, 기록 사이의 차이입니다.",
      "usage": "분석 자료가 일치하지 않을 때 원인과 기준 차이를 확인할 필요를 제기합니다."
    },
    "finance-quantify": {
      "meaning": "측정하거나 추산한 방법을 밝히면서 규모나 양, 효과를 숫자로 나타내는 것입니다.",
      "usage": "전략 선택의 효과나 문제의 크기를 검토 가능한 수치로 제시할 때 사용합니다."
    },
    "finance-assumption": {
      "meaning": "분석이나 계획을 위해 아직 충분히 확인하지 않은 내용을 사실로 놓은 전제입니다.",
      "usage": "권고가 어떤 전제에 의존하는지 밝히고 검증할 항목을 정할 때 사용합니다."
    },
    "finance-baseline": {
      "meaning": "이후 결과나 차이, 제안한 변화를 비교하기 위해 명시한 기준값이나 출발 상태입니다.",
      "usage": "개선 효과를 설명하기 전에 무엇을 비교 기준으로 삼는지 확인할 때 사용합니다."
    },
    "finance-sensitivity": {
      "meaning": "입력값이나 전제, 조건이 달라질 때 분석 결과가 변하는 정도입니다.",
      "usage": "주요 전제를 바꾸면 결론이 얼마나 달라지는지 검토할 때 사용합니다."
    },
    "finance-scenario": {
      "meaning": "특정 조건 조합에서 의사결정에 미칠 영향을 살펴보는 일관된 미래의 가능 상황입니다.",
      "usage": "여러 미래 조건에서 전략이 어떻게 작동할지 비교하되 예측 확정치로 말하지 않습니다."
    },
    "finance-validate": {
      "meaning": "해당 목적과 결정에 필요한 만큼 주장이나 전제, 방식이 근거로 뒷받침되는지 확인하는 것입니다.",
      "usage": "분석 방향이나 제안을 채택하기 전 핵심 가정을 점검할 때 사용합니다."
    },
    "finance-threshold": {
      "meaning": "합의한 규칙에 따라 결정이나 조치, 접근 방식의 변경이 필요해지는 기준 수준이나 조건입니다.",
      "usage": "어떤 조건에서 추진하거나 멈추고 재검토할지 명확히 정할 때 사용합니다."
    },
    "finance-accountability": {
      "meaning": "결과나 결정의 진행을 보고하고 적절한 권한 범위 안에서 문제를 해결해야 하는 책임입니다.",
      "usage": "권고를 실행할 때 누가 성과를 설명하고 문제에 대응할지 명확히 할 때 사용합니다."
    },
    "finance-rationale": {
      "meaning": "목표와 근거, 상황으로부터 권고나 결정이 도출되는 이유를 연결한 설명입니다.",
      "usage": "분석 결과에서 권고로 이어지는 논리를 고객이 이해할 수 있게 할 때 사용합니다."
    },
    "finance-challenge": {
      "meaning": "주장이나 전제, 제안을 그대로 받아들이지 않고 논리와 근거, 영향을 따져 묻는 것입니다.",
      "usage": "사람을 공격하기보다 분석의 취약한 전제나 근거를 검토할 때 사용합니다."
    },
    "finance-caveat": {
      "meaning": "결과나 추정치, 권고를 정확히 해석하기 위해 알아야 할 단서나 한계입니다.",
      "usage": "분석의 적용 범위나 제한을 밝히고 결론을 과도하게 확대하지 않도록 할 때 사용합니다."
    },
    "finance-exposure": {
      "meaning": "특정 위험이나 불리한 사건이 자원과 성과, 조직에 영향을 줄 수 있는 정도입니다.",
      "usage": "전략 선택으로 무엇이 얼마나 위험에 놓일 수 있는지 논의할 때 사용합니다."
    },
    "finance-reconcile": {
      "meaning": "설명이나 수치, 정의의 차이를 풀어 공통 기준에서 관계를 이해할 수 있게 하는 것입니다.",
      "usage": "자료 간 결과가 다를 때 정의와 전제의 차이를 확인해 일관된 해석을 만들 때 사용합니다."
    },
    "finance-material": {
      "meaning": "해당 맥락에서 판단이나 결정, 문제 이해에 영향을 줄 만큼 중요하다는 뜻입니다.",
      "usage": "분석의 차이나 위험이 실제 결정에 의미가 있는지 구분할 때 사용합니다."
    },
    "finance-substantiate": {
      "meaning": "청중이 검토하고 판단할 수 있는 관련 근거와 논리로 주장이나 권고를 뒷받침하는 것입니다.",
      "usage": "고객에게 제시하는 결론의 증거와 판단 과정을 설명할 때 사용합니다."
    },
    "project-prioritise": {
      "meaning": "목표와 제약, 결정 기준에 따라 먼저 관심을 둘 행동이나 문제를 정하는 것입니다.",
      "usage": "제한된 분석 시간이나 실행 자원을 어디에 집중할지 고객과 정할 때 사용합니다."
    },
    "project-scope": {
      "meaning": "특정 업무에 포함되는 질문과 활동, 산출물의 경계입니다.",
      "usage": "분석에 포함할 범위와 제외할 범위를 합의해 기대를 명확히 할 때 사용합니다."
    },
    "project-trade-off": {
      "meaning": "한 이점을 더 얻기 위해 다른 이점을 줄이거나 관련 비용을 받아들여야 하는 선택 관계입니다.",
      "usage": "전략 대안이 주는 이익과 포기해야 할 부분을 함께 비교할 때 사용합니다."
    },
    "project-dependency": {
      "meaning": "다른 프로젝트 활동이 계획대로 진행되기 위해 필요한 입력이나 행동, 조건입니다.",
      "usage": "실행 순서와 일정이 어떤 정보나 결정에 달려 있는지 설명할 때 사용합니다."
    },
    "project-milestone": {
      "meaning": "개별 과업이 아니라 프로젝트의 의미 있는 진척을 확인하는 중요한 사건이나 단계 완료입니다.",
      "usage": "핵심 분석 완료나 주요 의사결정 시점을 기준으로 진행을 보고할 때 사용합니다."
    },
    "project-viable": {
      "meaning": "요건과 자원, 중요한 조건을 고려했을 때 해당 상황에서 제대로 작동할 수 있다는 뜻입니다.",
      "usage": "전략 대안이 실무와 사업 조건을 충족해 성립할 수 있는지 판단할 때 사용합니다."
    },
    "project-iterate": {
      "meaning": "첫 안을 최종안으로 보지 않고 피드백과 시험, 새 근거를 반영해 여러 차례 개선하는 것입니다.",
      "usage": "분석이나 권고를 단계적으로 다듬는 과정을 설명할 때 사용합니다."
    },
    "sales-value-proposition": {
      "meaning": "특정 고객에게 제공하는 이익과 그 이익이 고객의 필요에 중요한 이유를 명확히 설명한 것입니다.",
      "usage": "전략을 내부 활동 목록으로만 보지 않고 구체적인 고객 가치와 연결할 때 사용합니다."
    },
    "consulting-hypothesis": {
      "meaning": "이미 확립된 결론이 아니라 검증의 출발점으로 세운 잠정적인 설명이나 답입니다.",
      "usage": "분석 방향과 그 설명을 검토하기 위해 수집할 근거를 명확히 할 때 사용합니다."
    },
    "consulting-synthesise": {
      "meaning": "여러 출처의 관련 정보를 결합해 각 부분의 관계를 설명하는 일관된 이해를 만드는 것입니다.",
      "usage": "사실을 나열하는 데 그치지 않고 근거가 고객의 결정에 어떤 의미인지 연결할 때 사용합니다."
    },
    "consulting-benchmark": {
      "meaning": "성과나 방식을 비교하는 기준점으로 맥락과 측정 정의에 따라 적합성이 달라집니다.",
      "usage": "다른 조직의 수치를 그대로 목표로 삼기보다 비교 조건을 확인하고 질문을 발전시킬 때 사용합니다."
    },
    "consulting-workstream": {
      "meaning": "전체 프로젝트 안에서 특정 질문이나 영역, 성과에 집중하는 관련 활동의 묶음입니다.",
      "usage": "프로젝트를 어떻게 나누며 누가 연관된 활동을 책임지는지 설명할 때 사용합니다."
    },
    "consulting-actionable": {
      "meaning": "청중이 실제 행동이나 결정, 다음 단계를 정할 수 있을 만큼 구체적이고 실용적이라는 뜻입니다.",
      "usage": "고객이 분석 이해를 넘어 담당자가 분명한 실행으로 옮길 수 있는지 확인할 때 사용합니다."
    },
    "consulting-triangulate": {
      "meaning": "서로 보완하는 출처나 방법, 관점을 비교해 해석을 뒷받침하거나 반박하고 정교하게 만드는 것입니다.",
      "usage": "중요한 결론을 여러 각도에서 검토하고 자료 간 차이로 이해를 개선할 때 사용합니다."
    },
    "consulting-operating-model": {
      "meaning": "조직이 업무를 수행하도록 사람과 절차, 책임, 기술, 자원을 구성한 운영 방식입니다.",
      "usage": "하나의 사업만으로 부족하고 일하는 방식 전반의 조율된 변화가 필요할 때 사용합니다."
    },
    "consulting-executive-summary": {
      "meaning": "고위 독자를 위해 핵심 질문과 주요 결과, 권고, 의사결정상 의미를 간결하게 정리한 요약입니다.",
      "usage": "세부 분석에 앞서 고객이 판단의 논리를 빠르게 파악하도록 할 때 사용합니다."
    },
    "operations-contingency": {
      "meaning": "선호하는 계획을 방해할 수 있는 사건에 대비해 마련한 대응이나 예비 조치입니다.",
      "usage": "구체적인 어려움이 생길 경우 고객이 무엇을 할지 정해 권고의 실행력을 높일 때 사용합니다."
    },
    "project-product-deliverable": {
      "meaning": "분석이나 작업 문서, 권고안처럼 프로젝트에서 제공하기로 합의한 구체적인 산출물입니다.",
      "usage": "고객이 무엇을 받고 그것이 어떤 결정이나 행동을 지원하는지 명확히 할 때 사용합니다."
    },
    "project-product-opportunity-cost": {
      "meaning": "한 선택에 자원이나 관심을 투입하면서 포기한 차선의 대안이 주었을 가치인 기회비용입니다.",
      "usage": "직접 지출뿐 아니라 제한된 자원을 다른 곳에 쓰지 못하는 비용을 비교할 때 사용합니다."
    },
    "project-product-sequence": {
      "meaning": "의존 관계와 학습 가치, 실무 요건을 고려해 활동이나 결정을 목적에 맞는 순서로 배치하는 것입니다.",
      "usage": "어떤 행동을 먼저 해야 하며 단계가 어떻게 목표로 이어지는지 설명할 때 사용합니다."
    },
    "project-product-decision-rights": {
      "meaning": "조언과 정보 제공, 실행 역할과 구분해 특정 결정을 내릴 명시적인 권한입니다.",
      "usage": "전략이나 운영 모델에서 중앙과 현장, 공동 결정의 권한을 나눌 때 사용합니다."
    },
    "project-product-evidence-gap": {
      "meaning": "결론이나 결정의 강도와 범위, 정확도를 제한하는 관련 정보의 공백입니다.",
      "usage": "무엇이 아직 뒷받침되지 않으며 추가 분석이나 조건부 권고가 필요한지 설명할 때 사용합니다."
    },
    "project-product-recommendation": {
      "meaning": "근거와 고객 목표, 제약을 연결하는 이유를 들어 제안한 행동 방안입니다.",
      "usage": "조사 결과를 설명하는 데서 나아가 고객이 무엇을 왜 해야 하는지 제시할 때 사용합니다."
    },
    "project-product-pilot": {
      "meaning": "방식을 확대할지와 어떻게 확대할지 결정하기 전에 배우기 위해 범위를 제한한 초기 시험입니다.",
      "usage": "분명한 목적과 종료 후 판단 기준을 둔 시험으로 불확실성을 줄일 때 사용합니다."
    },
    "project-product-constructive-dissent": {
      "meaning": "사람을 깎아내리거나 진행을 막기보다 집단의 이해와 결정을 개선하려는 근거 있는 반대 의견입니다.",
      "usage": "팀이 너무 빨리 합의할 때 관련 우려로 제안을 검토하도록 권할 때 사용합니다."
    },
    "sales-business-development-stakeholder": {
      "meaning": "업무의 영향을 받거나 의견과 영향력, 결정 권한을 통해 업무에 관여하는 사람이나 집단입니다.",
      "usage": "분석과 권고 실행에 누구의 경험이나 의견, 권한이 필요한지 파악할 때 사용합니다."
    },
    "sales-business-development-ambiguity": {
      "meaning": "표현이나 정보, 쟁점을 합리적으로 두 가지 이상으로 이해할 수 있는 모호한 상태입니다.",
      "usage": "목표나 용어, 결정 범위가 불분명해 사람들이 다른 질문에 답하고 있을 때 사용합니다."
    },
    "sales-business-development-acknowledge": {
      "meaning": "우려나 의견, 한계를 논의에서 무시하지 않고 검토하도록 명시적으로 인정하는 것입니다.",
      "usage": "타당한 우려에 답하기 전에 권고의 단점도 고려했다는 점을 보여 줄 때 사용합니다."
    },
    "sales-business-development-reframe": {
      "meaning": "문제나 선택을 다른 유용한 관점으로 제시해 그 바탕의 논리를 더 명확히 검토하게 하는 것입니다.",
      "usage": "현재의 틀이 거짓 양자택일을 만들거나 중요한 판단 요소를 가릴 때 사용합니다."
    },
    "sales-business-development-mandate": {
      "meaning": "목표를 추진하거나 정해진 결정을 내리도록 사람이나 집단에 부여한 권한과 범위입니다.",
      "usage": "전략 과제의 권한을 밝히고 누가 권고를 실제 결정으로 바꿀 수 있는지 설명할 때 사용합니다."
    },
    "sales-business-development-stewardship": {
      "meaning": "맡겨진 자원과 약속, 장기적 이익을 책임 있게 돌보고 관리하는 것입니다.",
      "usage": "당장 프로젝트를 끝내는 것뿐 아니라 지속 가치와 신뢰, 장기적 영향을 고려할 리더십을 설명할 때 사용합니다."
    },
    "sales-business-development-mobilise": {
      "meaning": "명확한 목표를 향해 함께 행동하도록 필요한 사람과 전문성, 자원을 모으는 것입니다.",
      "usage": "권고를 실행할 시점에 참여자와 목적, 당장의 책임을 분명히 조직할 때 사용합니다."
    },
    "sales-business-development-recalibrate": {
      "meaning": "새로운 근거나 상황으로 기존 목표나 기대, 방식이 맞지 않게 되었을 때 다시 조정하는 것입니다.",
      "usage": "팀이 배운 내용을 근거로 방향을 바꾸며 수정한 방식의 이유를 설명할 때 사용합니다."
    },
    "operations-supply-chain-root-cause": {
      "meaning": "문제를 일으키는 데 기여하는 바탕의 요인으로 눈에 띈다는 이유만이 아니라 근거로 확인해야 합니다.",
      "usage": "표면의 증상 아래 원인을 살피되 여러 원인이 상호 작용할 수 있음을 인정할 때 사용합니다."
    },
    "operations-supply-chain-defensible": {
      "meaning": "확실하거나 유일한 입장은 아니어도 관련 논리와 근거로 타당성을 뒷받침할 수 있다는 뜻입니다.",
      "usage": "고객에게 내놓는 결론이 논리와 근거, 한계에 대한 공정한 검토를 견딜 수 있는지 판단할 때 사용합니다."
    },
    "operations-supply-chain-interdependence": {
      "meaning": "사업이나 팀, 성과가 서로의 입력과 결정, 진척에 의존하는 관계입니다.",
      "usage": "전략 과제를 다른 관련 업무와 완전히 분리해 계획하거나 평가할 수 없는 이유를 설명합니다."
    },
    "operations-supply-chain-governance": {
      "meaning": "중요한 결정과 감독, 책임, 상위 보고를 어떻게 운영하는지 정한 체계입니다.",
      "usage": "실행 중 누가 결정하고 감독하며 중요한 문제를 어디서 다루는지 설명할 때 사용합니다."
    },
    "operations-supply-chain-alignment": {
      "meaning": "목표와 우선순위, 행동을 충분히 함께 이해해 조율된 결정과 협업이 가능한 상태입니다.",
      "usage": "막연히 합의했다고 말하기보다 합의한 부분과 추가로 필요한 결정을 구체화할 때 사용합니다."
    },
    "operations-supply-chain-capability": {
      "meaning": "필요한 지식과 자원, 업무 방식을 갖추어 특정 종류의 일을 수행할 수 있는 조직이나 팀의 역량입니다.",
      "usage": "전략 목표를 꾸준히 실행하려면 조직이 무엇을 할 수 있어야 하는지 설명할 때 사용합니다."
    },
    "operations-supply-chain-sustainability": {
      "meaning": "무리한 조건이나 요구에 의존하지 않고 방식을 장기적으로 계속 유지할 수 있는 성질입니다.",
      "usage": "성과의 지속 가능성을 검토하면서 운영·재무·환경 중 어느 의미인지 명확히 할 때 사용합니다."
    },
    "technology-engineering-correlation": {
      "meaning": "측정한 두 가지가 함께 변하는 관찰된 연관성으로 그 자체만으로 인과관계를 입증하지는 못합니다.",
      "usage": "자료의 연관성을 설명하면서 원인 설명과 구분할 때 사용합니다."
    },
    "people-human-resources-causation": {
      "meaning": "한 요인이 결과를 만들어 내는 데 기여하는 관계로 단순한 연관성이나 순서 이상의 근거가 필요합니다.",
      "usage": "특정 과제가 사업 성과를 냈다고 책임 있게 주장할 수 있는지 검토할 때 사용합니다."
    },
    "people-human-resources-confounding-factor": {
      "meaning": "제안한 설명과 결과 양쪽에 관련되어 그 관계의 해석을 왜곡할 수 있는 추가 요인입니다.",
      "usage": "눈에 보이는 연관성이 비교 대상 간의 다른 차이에서 일부 비롯되었을 가능성을 살필 때 사용합니다."
    },
    "people-human-resources-uncertainty": {
      "meaning": "관련 사실과 관계, 미래 결과를 충분히 알지 못해 판단의 확신에 영향을 주는 상태입니다.",
      "usage": "무엇을 모르며 그 공백이 결정이나 다음 분석에 어떤 영향을 주는지 구체화할 때 사용합니다."
    },
    "people-human-resources-counterfactual": {
      "meaning": "특정 행동이나 사건이 없었을 때 일어날 수 있거나 일어났을 일을 비교 기준으로 설정한 것입니다.",
      "usage": "대안의 가치를 과장하지 않도록 현실적인 비교 상황을 두고 검토할 때 사용합니다."
    },
    "consulting-strategy-issue-tree": {
      "meaning": "큰 질문을 따로 살펴볼 수 있는 작은 질문이나 가능한 원인으로 구조화해 나눈 문제 분해도입니다.",
      "usage": "복잡한 문제를 분석하기 위해 어떤 질문부터 조사할지 팀과 합의할 때 사용합니다."
    },
    "consulting-strategy-key-question": {
      "meaning": "고객의 유용한 결정을 돕기 위해 현재 작업에서 반드시 답해야 할 가장 중요한 질문입니다.",
      "usage": "흥미로운 부수 쟁점이 많아도 분석을 핵심 결정에 집중시킬 때 사용합니다."
    },
    "consulting-strategy-blocker": {
      "meaning": "업무나 결정을 어렵게 하는 데 그치지 않고 현재 진행 자체를 막고 있는 미해결 문제입니다.",
      "usage": "무엇이 멈춰 있으며 이를 풀기 위해 후원자에게 어떤 결정이 필요한지 분명히 요청할 때 사용합니다."
    },
    "consulting-strategy-emerging-theme": {
      "meaning": "근거에서 반복해 나타나기 시작했지만 아직 최종 결과로 볼 만큼 확립되지 않은 주제나 양상입니다.",
      "usage": "예비 정성 분석 결과를 공유해 추가 질문을 정하되 확정 결론으로 제시하지 않습니다."
    },
    "consulting-strategy-takeaway": {
      "meaning": "논의나 분석에서 청중이 기억하고 다음 결정에 연결해야 할 핵심 요점입니다.",
      "usage": "설명을 마치며 근거가 행동에 주는 의미를 간결하게 정리할 때 사용합니다."
    },
    "consulting-strategy-like-for-like": {
      "meaning": "비교하려는 항목과 정의, 조건, 기간이 충분히 비슷해 의미 있는 비교가 된다는 뜻입니다.",
      "usage": "단순 수치 비교에 앞서 조정하거나 같은 조건으로 묶어야 하는 이유를 설명할 때 사용합니다."
    },
    "consulting-strategy-symptom": {
      "meaning": "문제가 있음을 드러내지만 왜 생겼는지까지 설명하지는 않는 관찰 가능한 징후입니다.",
      "usage": "눈에 보이는 결과를 원인으로 오해할 때 가능한 원인을 더 살필 필요를 제기합니다."
    },
    "consulting-strategy-causal-mechanism": {
      "meaning": "제안한 원인이 검토 중인 결과를 만들어 낼 수 있는 과정이나 경로입니다.",
      "usage": "인과 주장을 할 때 실제로 어떤 과정을 통해 효과가 생기는지 설명할 때 사용합니다."
    },
    "consulting-strategy-unit-of-analysis": {
      "meaning": "고객이나 거래, 팀, 사업장, 기간 등 분석에서 관찰하거나 비교하는 대상의 단위입니다.",
      "usage": "관찰값 하나가 무엇을 뜻하며 한 수준의 결론을 다른 수준에 적용할 수 있는지 확인할 때 사용합니다."
    },
    "consulting-strategy-segmentation": {
      "meaning": "분석이나 전략 목적에 맞게 관련 모집단이나 관찰값을 의미 있는 집단으로 나누는 것입니다.",
      "usage": "전체 평균에 가려진 중요한 차이를 드러내 고객의 결정에 답할 때 사용합니다."
    },
    "consulting-strategy-granularity": {
      "meaning": "특정 질문을 위해 정보를 수집하고 묶거나 분석하는 세부 수준입니다.",
      "usage": "질문에 정확히 답하려면 어느 정도의 상세함이 필요한지 설명할 때 사용합니다."
    },
    "consulting-strategy-confidence": {
      "meaning": "분석의 한계와 가용 근거에 비추어 결론이나 추정치를 정당하게 신뢰할 수 있는 정도입니다.",
      "usage": "결과 중 근거가 강한 부분과 약한 부분의 확신 수준이 다른 이유를 설명할 때 사용합니다."
    },
    "consulting-strategy-optionality": {
      "meaning": "불확실한 상황에서 한 경로에 너무 일찍 묶이지 않고 의미 있는 미래의 선택을 유지할 수 있는 여지입니다.",
      "usage": "유연성을 보존하는 가치와 고객이 나중에 내릴 수 있도록 남겨 두는 결정을 설명할 때 사용합니다."
    },
    "consulting-strategy-premise": {
      "meaning": "아직 충분히 확인되었는지와 관계없이 논증이나 권고의 출발점으로 삼는 명제입니다.",
      "usage": "어떤 출발 전제가 참이어야 논리가 성립하며 무엇을 먼저 논의해야 하는지 설명할 때 사용합니다."
    },
    "consulting-strategy-implicit-assumption": {
      "meaning": "당사자가 분명히 인식하거나 말하지 않았어도 논증이 의존하고 있는 믿음이나 조건입니다.",
      "usage": "제안의 논리를 떠받치는 숨은 전제를 드러내 함께 검토할 때 사용합니다."
    },
    "consulting-strategy-inconsistency": {
      "meaning": "서로 맞아야 할 진술과 행동, 지표, 논리 사이에 일치나 정합성이 부족한 상태입니다.",
      "usage": "주장이나 제안의 요소들이 맞지 않아 의도한 논리를 확인할 필요가 있을 때 사용합니다."
    },
    "consulting-strategy-overgeneralisation": {
      "meaning": "사례나 근거가 뒷받침할 수 있는 범위보다 넓게 결론을 적용하는 과도한 일반화입니다.",
      "usage": "실제로 조사한 집단과 기간, 조건에 맞게 주장의 범위를 좁힐 때 사용합니다."
    },
    "consulting-strategy-contestable": {
      "meaning": "근거나 해석, 전제에 대해 합리적으로 이의를 제기할 수 있다는 뜻입니다.",
      "usage": "검토가 필요한 주장임을 알리면서 반드시 틀렸거나 부정직하다는 뜻으로 말하지 않습니다."
    },
    "consulting-strategy-counterargument": {
      "meaning": "다른 해석이나 영향, 선택 근거를 제시해 기존 주장이나 권고에 논리적으로 반론하는 것입니다.",
      "usage": "설득력 있는 대안 관점을 공정하게 검토하고 결론을 바꾸는지 설명할 때 사용합니다."
    },
    "consulting-strategy-facilitate": {
      "meaning": "적절한 진행 구조와 참여 기회를 통해 집단이 소통하고 생각하며 유용한 결과로 나아가도록 돕는 것입니다.",
      "usage": "회의나 논의를 지원하는 역할을 설명하되 정답을 결정할 권한과는 구분합니다."
    },
    "consulting-strategy-probe": {
      "meaning": "진술의 세부 사항이나 이유, 근거를 더 깊이 이해하기 위해 초점을 맞춘 후속 질문을 하는 것입니다.",
      "usage": "첫 답변이 분석에 쓰기에는 너무 포괄적일 때 정중하게 더 구체적인 내용을 물을 때 사용합니다."
    },
    "consulting-strategy-decision-criterion": {
      "meaning": "목표에 맞게 대안을 판단하거나 제안한 행동의 적합성을 정하는 데 사용하는 기준입니다.",
      "usage": "선택이나 기각의 근거를 논의 참여자들이 명확히 알 수 있게 할 때 사용합니다."
    },
    "consulting-strategy-implementation-pathway": {
      "meaning": "주요 단계와 의존 관계, 담당자, 결정을 포함해 권고에서 실제 실행으로 이어지는 일관된 경로입니다.",
      "usage": "매력적인 권고를 시간이 지나며 어떻게 실행 가능한 행동으로 바꿀지 설명할 때 사용합니다."
    },
    "consulting-strategy-success-measure": {
      "meaning": "행동이 의도한 성과나 진전을 내는지 평가하기 위해 합의한 지표입니다.",
      "usage": "활동 완료 여부뿐 아니라 실행 후 고객이 성과를 어떻게 평가할지 명확히 할 때 사용합니다."
    },
    "consulting-strategy-strategic-intent": {
      "meaning": "조직이 주요 선택을 통해 의도적으로 추구하는 전체적인 방향이나 성과입니다.",
      "usage": "개별 권고를 더 큰 목적과 연결하고 그 방향에 맞지 않는 선택을 드러낼 때 사용합니다."
    },
    "consulting-strategy-coherence": {
      "meaning": "여러 선택이나 활동이 논리적으로 맞물려 이해할 수 있는 전체 방향을 이루는 정합성입니다.",
      "usage": "권고안들이 같은 방향을 강화하는지, 전제나 유인이 서로 충돌하는지 평가할 때 사용합니다."
    },
    "consulting-strategy-portfolio": {
      "meaning": "자원을 두고 경쟁하거나 전체 목표에 함께 기여하므로 묶어서 검토하는 사업과 활동, 투자의 집합입니다.",
      "usage": "여러 과제의 균형과 의존 관계, 총자원 요구를 함께 평가할 때 사용합니다."
    },
    "consulting-strategy-scalability": {
      "meaning": "자원이나 복잡성이 감당하기 어려울 정도로 늘지 않아도 방식이나 시스템의 규모와 적용 범위를 확대할 수 있는 성질입니다.",
      "usage": "성공한 시범 도입을 확장할 때 물량이나 범위가 늘면 무엇이 달라지는지 검토합니다."
    },
    "consulting-strategy-resilience": {
      "meaning": "혼란이나 충격을 견디고 변화에 적응하며 중요한 기능을 계속 수행할 수 있는 역량입니다.",
      "usage": "평상시뿐 아니라 예상 가능한 차질 속에서도 전략이 기능할지 검토할 때 사용합니다."
    }
  }
};
