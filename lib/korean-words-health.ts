/**
 * Original Korean role-specific vocabulary support, authored against the canonical
 * roleContexts meaning and whenToUse. English examples remain canonical.
 * Specialist sense checks (15 October 2026; definitions are not copied):
 * https://www.nhs.uk/tests-and-treatments/consent-to-treatment/
 * https://www.ahrq.gov/health-literacy/improve/precautions/tool5.html
 * https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html
 * https://www.cancer.gov/publications/dictionaries/cancer-terms/def/prognosis
 * https://www.cancer.gov/publications/dictionaries/cancer-terms/def/contraindication
 * https://medlineplus.gov/lab-tests/differential-diagnosis/
 * Healthcare clinical terms retain the source's recognition-only boundaries.
 */
export const koreanHealthWords: Record<string, Record<string, { meaning: string; usage: string }>> = {
  "operations-supply-chain": {
    "finance-discrepancy": {
      "meaning": "서로 일치해야 할 기록이나 관찰 내용 사이에 설명이 필요한 차이가 있는 상태입니다.",
      "usage": "사실관계의 불일치를 알리되 원인은 관련 증거를 확인한 뒤 판단할 때 씁니다."
    },
    "finance-consolidate": {
      "meaning": "따로 있는 물량이나 업무를 하나의 조정된 묶음으로 합치는 것입니다.",
      "usage": "배송 조건과 고객 약속을 지키면서 여러 물량이나 업무를 합칠 때 씁니다."
    },
    "finance-provisional": {
      "meaning": "현재는 임시로 사용할 수 있지만 추가 확인이나 승인에 따라 바뀔 수 있는 상태입니다.",
      "usage": "확정 전인 운영 계획이나 해석을 사용 가능한 범위와 함께 설명할 때 씁니다."
    },
    "finance-handover": {
      "meaning": "미완료 업무가 이어질 수 있도록 운영 정보와 책임을 다른 담당자나 교대조에 체계적으로 넘기는 것입니다.",
      "usage": "교대나 업무 이관 때 진행 상황과 남은 조치, 다음 담당자를 전달할 때 씁니다."
    },
    "finance-proportionate": {
      "meaning": "확인된 문제와 예상 영향, 운영 요건에 비추어 대응의 규모와 강도가 적절한 상태입니다.",
      "usage": "제한 조치나 조사, 자원 투입이 실제 문제에 맞는지 검토할 때 씁니다."
    },
    "finance-assumption": {
      "meaning": "아직 확인되지 않았더라도 계획이나 판단을 위해 사실이라고 놓고 생각하는 전제입니다.",
      "usage": "수요 예측이나 납기 약속에 쓰인 불확실한 입력값을 분명히 밝힐 때 씁니다."
    },
    "finance-baseline": {
      "meaning": "나중의 운영 변화를 비교하기 위해 명시적으로 정해 둔 기준 측정값입니다.",
      "usage": "공정 시험 전에 개선 여부를 어떤 기준과 비교할지 정할 때 씁니다."
    },
    "finance-sensitivity": {
      "meaning": "입력 가정이 바뀔 때 운영 결과나 권고안이 얼마나 달라지는지를 나타냅니다.",
      "usage": "생산 능력 판단에 큰 영향을 주는 가정과 추가 정보가 필요한 부분을 설명할 때 씁니다."
    },
    "finance-scenario": {
      "meaning": "운영 대응을 검토하기 위해 구성한 가능한 조건들의 조합이며 실제 발생을 예측한 것은 아닙니다.",
      "usage": "불확실한 사건들의 조합에 따라 운영 여건이 어떻게 달라질지 비교할 때 씁니다."
    },
    "finance-corroborate": {
      "meaning": "관련된 추가 증거로 어떤 진술이나 조사 결과를 뒷받침하는 것입니다.",
      "usage": "여러 기록이 같은 세부 사실을 지지하되 각각 확인하는 범위가 다를 때 씁니다."
    },
    "finance-accountability": {
      "meaning": "결정이나 결과에 대해 설명하고 합의된 책임이 끝까지 이행되도록 해야 하는 의무입니다.",
      "usage": "개선안을 일상 운영에 정착시킨 뒤 누가 지속적인 점검과 후속 조치를 책임질지 정할 때 씁니다."
    },
    "finance-assurance": {
      "meaning": "정해진 운영 체계나 통제가 의도대로 작동한다는 적절한 증거와 검토에 근거한 신뢰입니다.",
      "usage": "절차나 도입 준비 상태를 믿을 수 있는 근거를 경영진에게 설명할 때 씁니다."
    },
    "finance-constraint": {
      "meaning": "운영에서 선택할 수 있는 방안이나 계획의 성과를 제한하는 조건입니다.",
      "usage": "좋아 보이는 방안도 공간이나 인력 등의 제약 때문에 그대로 실행할 수 없음을 설명할 때 씁니다."
    },
    "finance-ownership": {
      "meaning": "담당자가 후속 조치와 협업을 이끌어 업무나 문제를 합의된 결과까지 마무리할 책임입니다.",
      "usage": "여러 팀에 걸친 업무가 방치되지 않도록 끝까지 챙길 담당자를 정할 때 씁니다."
    },
    "finance-caveat": {
      "meaning": "운영에 관한 설명이나 권고를 해석하고 적용할 때 고려해야 할 구체적인 주의점이나 제한 조건입니다.",
      "usage": "결과를 유용하게 활용하되 신뢰도나 적용 범위를 제한하는 조건을 밝힐 때 씁니다."
    },
    "finance-exposure": {
      "meaning": "특정한 불확실한 사건이나 위험 요인으로 인해 운영이 영향을 받을 수 있는 정도입니다.",
      "usage": "현재의 통제와 대안을 고려해도 여전히 위험에 노출된 운영 영역을 설명할 때 씁니다."
    },
    "finance-variance": {
      "meaning": "실제 운영 결과와 명시한 계획, 목표 또는 비교 기준 사이의 차이입니다.",
      "usage": "원인이나 시정 조치를 논의하기 전에 생산량 등에서 발생한 차이를 수치로 설명할 때 씁니다."
    },
    "finance-substantiate": {
      "meaning": "주장이나 설명의 근거를 검토할 수 있도록 관련 증거로 뒷받침하는 것입니다.",
      "usage": "의사결정에 중요한 공급업체나 운영 관련 주장에 구체적인 증거를 요청할 때 씁니다."
    },
    "project-prioritise": {
      "meaning": "여러 운영 업무 가운데 더 중요하여 먼저 시간이나 자원을 배정할 일을 정하는 것입니다.",
      "usage": "수요가 가용 자원을 넘을 때 명확한 기준에 따라 처리 순서를 정할 때 씁니다."
    },
    "project-trade-off": {
      "meaning": "한 운영상 이점을 얻으려면 다른 가치 있는 결과를 일부 포기하거나 줄여야 하는 선택입니다.",
      "usage": "자원 제약 때문에 원하는 결과들을 모두 얻을 수 없어 선택의 대가를 설명할 때 씁니다."
    },
    "project-dependency": {
      "meaning": "다른 운영 활동이 진행되기 위해 먼저 필요로 하는 업무, 결정, 자원 또는 외부 조건입니다.",
      "usage": "후속 일정이 다른 팀의 특정 작업이나 확인에 달려 있음을 설명할 때 씁니다."
    },
    "project-milestone": {
      "meaning": "운영 개선이 합의된 단계에 도달했음을 확인할 수 있는 중요한 진행 지점입니다.",
      "usage": "단순히 활동을 했다는 보고 대신 검증 가능한 진척을 제시할 때 씁니다."
    },
    "technology-scalable": {
      "meaning": "수요가 늘어도 노력이나 비용이 지나치게 증가하거나 성능이 크게 떨어지지 않도록 규모를 확대할 수 있는 상태입니다.",
      "usage": "거점이나 주문 수가 늘어날 때 운영 절차가 그 증가를 감당할 수 있는지 설명할 때 씁니다."
    },
    "technology-resilient": {
      "meaning": "대비책과 유연성, 대체 수단을 통해 특정 차질에도 핵심 운영을 이어 가거나 회복할 수 있는 상태입니다.",
      "usage": "어떤 중단에 견딜 수 있고 무엇이 서비스 유지나 복구를 가능하게 하는지 설명할 때 씁니다."
    },
    "technology-bottleneck": {
      "meaning": "전체 공정의 흐름이나 산출량을 현재 제한하는 단계 또는 자원입니다.",
      "usage": "전체 처리량을 막는 지점이 증거로 확인되어 자원 투입의 우선순위를 검토할 때 씁니다."
    },
    "sales-qualify": {
      "meaning": "조건이나 예외, 불확실성을 덧붙여 진술의 의미나 적용 범위를 한정하는 것입니다.",
      "usage": "광범위한 운영 주장이 증거보다 과장되거나 중요한 예외를 가릴 수 있을 때 씁니다."
    },
    "people-onboarding": {
      "meaning": "신규 직원이 업무에 필요한 접근 권한과 이해, 관계, 지도하의 실습을 갖추도록 돕는 적응 과정입니다.",
      "usage": "교육과 지원, 절차 이해를 함께 마련하며 새 역할로의 전환을 계획할 때 씁니다."
    },
    "people-attrition": {
      "meaning": "직원들의 퇴사로 인력이 서서히 줄어들며 인원이나 숙련도 확보에 영향을 주는 현상입니다.",
      "usage": "퇴사 이유를 추정하지 않고 확인된 이탈 추세와 운영상 영향을 설명할 때 씁니다."
    },
    "consulting-benchmark": {
      "meaning": "운영 성과를 해석하는 데 참고하는 적절한 표준이나 비교 대상의 결과입니다.",
      "usage": "자체 목표 달성 여부 외에 의미 있는 내부 또는 외부 비교가 필요할 때 씁니다."
    },
    "consulting-workstream": {
      "meaning": "더 큰 운영 개선 안에서 하나의 결과와 조정 책임자를 중심으로 연결된 업무 묶음입니다.",
      "usage": "여러 갈래의 업무가 하나의 개선 사업에 기여하는 상황을 나누어 보고할 때 씁니다."
    },
    "consulting-operating-model": {
      "meaning": "조직이 운영 목표를 달성하도록 사람, 절차, 의사결정 구조와 지원 시스템을 배치한 방식입니다.",
      "usage": "전략적 변화가 실제 팀과 시스템, 책임 분담에서 어떻게 작동할지 설명할 때 씁니다."
    },
    "operations-throughput": {
      "meaning": "일정 기간에 공정이 실제로 완료한 물량으로, 이론적으로 가능한 생산량과는 다릅니다.",
      "usage": "교대 보고에서 완료한 물량을 측정 기간과 운영 조건에 연결해 설명할 때 씁니다."
    },
    "operations-lead-time": {
      "meaning": "정해진 요청이나 시작 시점부터 필요한 결과물의 수령 또는 완료까지 걸리는 전체 시간입니다.",
      "usage": "공급업체 일정과 고객의 예상 납기를 연결해 설명할 때 시작점과 끝점을 밝혀 씁니다."
    },
    "operations-capacity": {
      "meaning": "명시한 조건과 기간 아래에서 시설이나 팀이 처리할 수 있는 업무량입니다.",
      "usage": "인력과 장비, 작업 시간, 제품 구성에 비추어 처리량 약속이 가능한지 논의할 때 씁니다."
    },
    "operations-contingency": {
      "meaning": "계획에 영향을 줄 수 있는 특정 상황이 발생할 경우를 대비해 마련한 대체 대응책입니다.",
      "usage": "발동 조건과 담당자, 가용 자원, 실제 적용 범위를 함께 제시할 때 씁니다."
    },
    "operations-inventory-turnover": {
      "meaning": "명시한 산식에 따라 일정 기간 재고가 사용되거나 판매된 뒤 보충되는 빈도를 나타내는 지표입니다.",
      "usage": "품목별 재고 가용성도 살피면서 재고의 이동과 묶여 있는 자금을 논의할 때 씁니다."
    },
    "operations-fulfilment": {
      "meaning": "주문 준비와 포장, 출고, 배송 준비 등 고객 주문을 완료하기 위해 필요한 운영 업무입니다.",
      "usage": "포장만이 아니라 서로 연결된 창고 업무 전체의 주문 이행을 논의할 때 씁니다."
    },
    "operations-expedite": {
      "meaning": "우선순위 조정이나 추가 자원 등을 통해 특정 업무의 진행 또는 완료를 앞당기는 것입니다.",
      "usage": "정상 일정으로는 부족해 확인과 승인 절차를 지키면서 주문이나 배송을 가속할 때 씁니다."
    },
    "operations-service-level": {
      "meaning": "합의된 지표와 목표, 제공 조건으로 정의한 서비스의 기준입니다.",
      "usage": "운영 약속을 고객의 기대나 공급업체의 성과 의무와 비교할 때 씁니다."
    },
    "healthcare-triage": {
      "meaning": "차질이 생긴 주문이나 운영 문제를 살펴 먼저 대응할 대상을 정하는 것입니다.",
      "usage": "여러 배송이나 공급업체 문제가 한정된 대응 자원을 두고 경쟁할 때 우선순위를 정하는 뜻으로 씁니다."
    },
    "healthcare-escalation": {
      "meaning": "문제를 해결할 권한이나 자원을 가진 담당자 또는 상위 단계에 안건을 올리는 것입니다.",
      "usage": "현재 팀이 내릴 수 없는 결정이나 제공할 수 없는 지원이 필요할 때 씁니다."
    },
    "project-product-acceptance-criteria": {
      "meaning": "특정 결정을 위해 운영 결과물이나 시험 결과가 적합한지 판단하도록 미리 합의한 조건입니다.",
      "usage": "시험이나 납품 전에 어떤 증거로 수용 여부를 결정할지 정할 때 씁니다."
    },
    "project-product-validation": {
      "meaning": "제안한 운영 방식이나 결과물이 정해진 용도에 적합한지 증거를 통해 확인하는 것입니다.",
      "usage": "시스템이 켜지는지만이 아니라 실제 업무 목적에 맞게 쓸 수 있는지 검증할 때 씁니다."
    },
    "project-product-buffer": {
      "meaning": "불확실성이나 변동을 흡수하도록 의도적으로 확보해 둔 여분의 재고, 시간 또는 처리 능력입니다.",
      "usage": "특정 변동 요인으로부터 납기 약속을 보호하는 여유분을 설명할 때 씁니다."
    },
    "project-product-mitigation": {
      "meaning": "확인된 운영 위험의 발생 가능성이나 영향을 줄이기 위한 조치로, 위험을 반드시 없애는 것은 아닙니다.",
      "usage": "제안한 통제나 행동이 어떤 위험을 어떻게 줄이는지 연결해 설명할 때 씁니다."
    },
    "project-product-feasibility": {
      "meaning": "자원과 일정, 제약, 필요한 조건을 고려할 때 제안을 실제로 실행할 수 있는 정도입니다.",
      "usage": "매력적인 운영 아이디어를 실행 약속으로 바꾸기 전에 현실성을 점검할 때 씁니다."
    },
    "project-product-opportunity-cost": {
      "meaning": "자원을 특정 선택에 투입하여 포기하게 되는 가장 나은 대안의 가치입니다.",
      "usage": "인력이나 장비, 공간을 한 곳에 배정하여 밀려나는 업무의 가치를 비교할 때 씁니다."
    },
    "project-product-sequence": {
      "meaning": "요건과 선행 조건, 목표 결과를 고려하여 운영 활동의 순서를 정하는 것입니다.",
      "usage": "작업 순서가 효율이나 준비 상태, 다른 팀의 진행에 영향을 줄 때 씁니다."
    },
    "project-product-decision-rights": {
      "meaning": "특정 결정에 대해 누가 결정하고 승인하거나 의견을 낼 수 있는지 정한 권한입니다.",
      "usage": "팀 간 공동 목표에서 결정권자와 자문 대상, 통보 대상을 분명히 할 때 씁니다."
    },
    "project-product-pilot": {
      "meaning": "전면 도입 전에 근거를 얻기 위해 제한된 범위에서 실시하는 운영 변화의 시험입니다.",
      "usage": "확인할 질문과 검토 시점이 있는 소규모 시험으로 불확실성을 줄일 때 씁니다."
    },
    "project-product-accountable": {
      "meaning": "결정이나 결과에 대해 설명하고 적절한 후속 조치를 보장할 책임이 있는 상태입니다.",
      "usage": "여러 사람이 작업을 나누어 해도 결과에 대해 최종적으로 답할 담당자를 정할 때 씁니다."
    },
    "sales-business-development-impasse": {
      "meaning": "해결되지 않은 의견 차이로 인해 당사자들의 논의가 더 진행되지 못하는 교착 상태입니다.",
      "usage": "특정 쟁점이 합의를 막아 다른 선택지나 권한자, 논의 방식이 필요할 때 씁니다."
    },
    "sales-business-development-concession": {
      "meaning": "수용 가능한 합의를 위해 협상 중 한쪽이 양보하는 구체적인 조건이나 이익입니다.",
      "usage": "더 큰 운영 목표를 위해 특정 조건에서 의도적으로 물러날 때 씁니다."
    },
    "sales-business-development-reciprocity": {
      "meaning": "한쪽의 건설적인 양보에 다른 쪽도 관련된 약속이나 이익으로 응하는 상호 교환입니다.",
      "usage": "공급업체 협상에서 제공하는 유연성에 상응하는 약속을 요청할 때 씁니다."
    },
    "sales-business-development-mandate": {
      "meaning": "정해진 조직적 한계 안에서 특정 목표를 추진하도록 명시적으로 부여받은 임무나 권한입니다.",
      "usage": "여러 부서가 함께하는 변화에서 운영 조직에 기대되는 일과 허용된 범위를 밝힐 때 씁니다."
    },
    "sales-business-development-stewardship": {
      "meaning": "맡겨진 자원과 절차, 장기적 이익을 책임감 있게 돌보고 관리하는 것입니다.",
      "usage": "당장의 납품과 자원의 책임 있는 사용, 운영 절차의 지속성을 함께 고려할 때 씁니다."
    },
    "operations-supply-chain-backlog": {
      "meaning": "보고 시점에 접수되었지만 아직 완료되지 않은 업무로, 대기 중이거나 기한이 지난 일을 포함합니다.",
      "usage": "다음 생산 가능 시간에 무엇을 배정할지 정하기 전에 미완료 수요를 설명할 때 씁니다."
    },
    "operations-supply-chain-disruption": {
      "meaning": "계획대로 운영 활동을 이어 가지 못하게 하는 중단이나 차질입니다.",
      "usage": "무엇이 달라졌고 어느 활동이 영향을 받으며 무엇은 계속 작동하는지 보고할 때 씁니다."
    },
    "operations-supply-chain-containment": {
      "meaning": "조사와 해결이 진행되는 동안 운영 문제의 확산이나 영향을 제한하는 임시 조치입니다.",
      "usage": "근본 원인이 밝혀지거나 제거되기 전에 즉각적인 영향 억제책을 설명할 때 씁니다."
    },
    "operations-supply-chain-cycle-time": {
      "meaning": "명확한 시작점과 끝점 사이에서 하나의 정해진 공정 주기를 완료하는 데 걸리는 시간입니다.",
      "usage": "반복 작업의 처리 시간을 일관되게 측정하여 변경 전후를 비교할 때 씁니다."
    },
    "operations-supply-chain-utilisation": {
      "meaning": "일정 기간 자원의 가용 시간이나 처리 능력 중 실제로 사용한 비율입니다.",
      "usage": "가동 정도를 산출량과 품질, 대기 시간, 측정 기준과 함께 설명할 때 씁니다."
    },
    "operations-supply-chain-stockout": {
      "meaning": "필요한 품목이 필요한 장소와 시점에 없어 사용할 수 없는 품절 상태입니다.",
      "usage": "품목과 장소, 발생 시점, 운영상 영향을 명시해 재고 부족을 보고할 때 씁니다."
    },
    "operations-supply-chain-replenishment": {
      "meaning": "발주나 생산, 다른 보관 지점에서의 이동을 통해 필요한 위치의 재고를 채우는 과정입니다.",
      "usage": "재고 가용성을 어떻게 회복하고 각 단계를 누가 맡는지 논의할 때 씁니다."
    },
    "operations-supply-chain-traceability": {
      "meaning": "관련 기록과 운영 단계를 통해 물품의 식별 정보, 이동이나 취급 이력을 추적할 수 있는 능력입니다.",
      "usage": "특정 물품의 이력이나 이동을 어떤 기록으로 확인할 수 있는지 설명할 때 씁니다."
    },
    "operations-supply-chain-reconciliation": {
      "meaning": "기록이나 수량을 체계적으로 비교하여 차이를 찾고 증거로 설명하거나 해소하는 과정입니다.",
      "usage": "서로 맞아야 하는 운영 기록들의 차이를 근거에 따라 대조할 때 씁니다."
    },
    "operations-supply-chain-root-cause": {
      "meaning": "조사 결과로 뒷받침되며 문제의 재발을 줄이려면 해결해야 하는 근본적인 원인입니다.",
      "usage": "증거를 통해 반복되거나 중대한 운영 실패의 발생 원리가 확인된 뒤 씁니다."
    },
    "operations-supply-chain-corrective-action": {
      "meaning": "확인된 문제의 원인을 다루어 같은 문제가 다시 발생할 가능성을 줄이는 조치입니다.",
      "usage": "조사 결과를 담당자와 기한, 원인 해소의 확인 근거가 있는 실행 계획으로 바꿀 때 씁니다."
    },
    "operations-supply-chain-preventive-action": {
      "meaning": "해당 공정에서 특정 문제가 발생하기 전에 잠재적인 문제나 원인을 줄이는 조치입니다.",
      "usage": "교훈이나 위험 검토를 근거로 다른 곳에서 비슷한 실패가 생기기 전에 대응할 때 씁니다."
    },
    "operations-supply-chain-volatility": {
      "meaning": "가격이나 수요 같은 수치가 시간에 따라 급격하거나 예측하기 어렵게 변하는 성향입니다.",
      "usage": "공급 가격이나 수요의 큰 변동으로 계획의 불확실성이 커질 때 씁니다."
    },
    "operations-supply-chain-variability": {
      "meaning": "반복해서 관찰한 운영 결과들이 서로 다른 정도로, 평균 주변의 배송 시간 편차 등이 해당합니다.",
      "usage": "평균값만으로 고객이나 계획 담당자의 경험을 충분히 설명할 수 없을 때 씁니다."
    },
    "operations-supply-chain-seasonality": {
      "meaning": "일정한 달력 주기의 특정 시기와 연관되어 수요나 공급에서 반복되는 양상입니다.",
      "usage": "해마다 되풀이되는 시기별 패턴으로 처리 능력이나 주문량, 예상 납기를 설명할 때 씁니다."
    },
    "operations-supply-chain-redundancy": {
      "meaning": "하나의 자원을 사용할 수 없더라도 운영할 수 있도록 추가 또는 중복 자원을 의도적으로 마련하는 것입니다.",
      "usage": "대체 운영 수단과 그것을 실제로 사용할 수 있는 조건을 설명할 때 씁니다."
    },
    "operations-supply-chain-concentration-risk": {
      "meaning": "한 공급업체나 장소, 경로 또는 공통 원천에 운영 의존도가 몰려 생기는 취약성입니다.",
      "usage": "겉으로는 별개인 계약들도 같은 중단 원인에 함께 영향을 받을 수 있음을 설명할 때 씁니다."
    },
    "operations-supply-chain-diminishing-returns": {
      "meaning": "같은 자원을 추가로 투입할수록 이전 추가분보다 더 작은 추가 이익을 얻는 양상입니다.",
      "usage": "인원이나 시간, 지출을 늘리는 것이 비례하는 효과를 내는지 검토할 때 씁니다."
    },
    "operations-supply-chain-attribution": {
      "meaning": "관찰된 결과가 특정 원인이나 조치, 사람 또는 기여 요인에서 비롯되었다고 보는 것입니다.",
      "usage": "운영 결과의 원인과 그 판단을 뒷받침하는 비교의 신뢰도를 논의할 때 씁니다."
    },
    "operations-supply-chain-nonconformance": {
      "meaning": "문서로 정한 요건이나 합의된 기준을 충족하지 못한 부적합 상태입니다.",
      "usage": "요건 미충족의 증거가 있어 공급업체나 공정에 공식적인 대응을 요청할 때 씁니다."
    },
    "operations-supply-chain-deviation": {
      "meaning": "정해진 계획이나 방식, 요건 또는 기대 결과에서 벗어난 상태입니다.",
      "usage": "원인이나 처리 방침을 결론 내리기 전에 합의된 기준과의 구체적인 차이를 설명할 때 씁니다."
    },
    "operations-supply-chain-specification": {
      "meaning": "물품이나 서비스, 공정이 제공하거나 충족해야 할 사항을 정의한 규격 또는 요구사항입니다.",
      "usage": "수용 여부나 공급업체의 설명, 변경 요청을 문서화된 요건과 비교할 때 씁니다."
    },
    "operations-supply-chain-defensible": {
      "meaning": "관련 증거와 명시한 기준, 적절한 의사결정 절차로 합리적으로 정당화할 수 있는 상태입니다.",
      "usage": "긴급한 상황이 지난 뒤에도 고객이나 검토자에게 결정의 근거를 설명할 수 있어야 할 때 씁니다."
    },
    "operations-supply-chain-reallocate": {
      "meaning": "이미 배정된 인력이나 장비, 업무 또는 처리 능력을 다른 용도로 옮겨 배정하는 것입니다.",
      "usage": "새 자원이 생긴 것처럼 설명하지 않고 기존 자원을 바뀐 운영 수요에 돌릴 때 씁니다."
    },
    "operations-supply-chain-standardise": {
      "meaning": "운영상 일관성이 필요한 부분에 합의된 방식이나 정의, 형식을 일정하게 정하는 것입니다.",
      "usage": "팀이나 거점마다 다른 관행이 오류나 비교, 인수인계의 어려움을 만들 때 씁니다."
    },
    "operations-supply-chain-streamline": {
      "meaning": "불필요한 작업이나 중복, 피할 수 있는 복잡성을 줄여 절차를 더 단순하고 효율적으로 만드는 것입니다.",
      "usage": "필요한 통제는 유지하면서 흐름을 개선할 구체적인 간소화 방안을 제안할 때 씁니다."
    },
    "operations-supply-chain-optimise": {
      "meaning": "운영상 제약과 절충점을 고려하면서 명시한 목표를 가장 잘 달성하도록 배치나 방식을 개선하는 것입니다.",
      "usage": "목표와 제약을 함께 고려하고 선택의 전체적인 효과를 측정하는 권고안을 제시할 때 씁니다."
    },
    "operations-supply-chain-interdependence": {
      "meaning": "운영 활동이나 자원이 서로 영향을 주고 서로에 의존하는 관계입니다.",
      "usage": "한 단계의 변화 때문에 다른 공정에서도 협의와 영향 점검이 필요한 이유를 설명할 때 씁니다."
    },
    "operations-supply-chain-governance": {
      "meaning": "적절한 권한 아래 의사결정을 내리고 성과를 감독하며 예외를 처리하도록 합의한 구조와 절차입니다.",
      "usage": "초기 도입 후에도 운영 사업이나 네트워크를 어떻게 감독하고 책임을 유지할지 설명할 때 씁니다."
    },
    "operations-supply-chain-alignment": {
      "meaning": "목표와 우선순위, 책임 또는 운영 결정의 방향에 대해 이해와 입장이 서로 맞는 상태입니다.",
      "usage": "여러 운영 조직의 이해 차이가 납품을 방해하지 않도록 방향을 맞출 때 씁니다."
    },
    "operations-supply-chain-succession": {
      "meaning": "기존 담당자가 이동하거나 떠날 때 핵심 책임을 이어받을 사람이나 체계를 계획적으로 준비하는 것입니다.",
      "usage": "후임자 육성과 지식 이전으로 중요한 운영 책임이 이어지도록 할 때 씁니다."
    },
    "operations-supply-chain-capability": {
      "meaning": "운영 활동을 효과적으로 수행하는 데 필요한 기술과 지식, 도구, 실질적인 수행 능력의 조합입니다.",
      "usage": "팀에 필요한 역량과 교육이나 도구, 경험을 보완할 부분을 설명할 때 씁니다."
    },
    "operations-supply-chain-risk-appetite": {
      "meaning": "조직이 목표를 추구하면서 정해진 한계 안에서 감수할 의사가 있는 위험의 종류와 수준입니다.",
      "usage": "중요한 운영 선택에서 남는 위험을 얼마나 수용할지 권한 있는 판단이 필요할 때 씁니다."
    },
    "operations-supply-chain-sustainability": {
      "meaning": "운영 개선이 평상시 근무 여건에서도 장기적으로 효과를 유지하며 뒷받침될 수 있는 정도입니다.",
      "usage": "시범 운영이나 특별 지원 기간이 끝난 뒤에도 개선 효과가 이어질지 판단할 때 씁니다."
    },
    "operations-supply-chain-continuous-improvement": {
      "meaning": "관찰과 피드백, 시험, 검토를 반복하여 운영 업무를 지속적으로 개선하는 접근법입니다.",
      "usage": "첫 도입을 완성으로 보지 않고 증거에 근거한 작은 개선을 계속할 때 씁니다."
    }
  },
  "healthcare": {
    "finance-discrepancy": {
      "meaning": "보통 서로 일치해야 할 정보들 사이에 차이가 있는 상태입니다.",
      "usage": "상충하는 기록을 중립적으로 설명하고 적절한 확인이나 수정을 요청할 때 씁니다."
    },
    "finance-provisional": {
      "meaning": "아직 확정되지 않았으며 추가 확인에 따라 바뀔 수 있는 잠정적인 상태입니다.",
      "usage": "의사소통이나 서비스 제공 방안에 필요한 확인이 아직 끝나지 않았음을 밝힐 때 씁니다."
    },
    "finance-handover": {
      "meaning": "진료 책임이 바뀔 때 전문가나 팀 사이에 관련 정보와 책임을 체계적으로 전달하는 인수인계입니다.",
      "usage": "업무를 받는 팀에 배경과 미해결 조치를 전하고 책임을 확인할 기회를 마련할 때 씁니다."
    },
    "finance-proportionate": {
      "meaning": "확인된 문제와 그 영향에 대응하는 규모가 적절하며 필수 요건도 지키는 상태입니다.",
      "usage": "필요한 보호 조치를 유지하면서 구체적인 의사소통 문제에 맞는 대응을 정할 때 씁니다."
    },
    "finance-assumption": {
      "meaning": "현재 정보로 확인되지 않았지만 추론 과정에서 사실이라고 놓고 생각하는 전제입니다.",
      "usage": "어떤 의사소통 행동에 대한 해석이 확인된 사실처럼 취급되고 있을 때 씁니다."
    },
    "finance-corroborate": {
      "meaning": "어떤 진술이나 설명의 특정 부분을 뒷받침하는 증거를 추가하는 것입니다.",
      "usage": "다른 기록이 전체 이야기보다 범위가 좁은 특정 사실을 지지함을 설명할 때 씁니다."
    },
    "finance-accountability": {
      "meaning": "합의된 책임이나 결과에 대해 설명하고 적절한 후속 조치가 이어지도록 할 의무입니다.",
      "usage": "공동 의사소통 체계를 계속 유지하고 점검할 담당자나 역할을 분명히 할 때 씁니다."
    },
    "finance-oversight": {
      "meaning": "업무가 적절히 관리되고 중요한 문제가 다뤄지는지 지속적으로 감독하거나 검토하는 것입니다.",
      "usage": "책임자가 모든 실무를 직접 하지 않고도 의사소통의 질을 어떻게 살피는지 설명할 때 씁니다."
    },
    "finance-assurance": {
      "meaning": "정해진 범위 안에서 특정 체계가 의도대로 작동한다는 적절한 증거와 검토에 근거한 신뢰입니다.",
      "usage": "의사소통 절차나 도입 상태를 믿을 수 있는 근거가 무엇인지 설명할 때 씁니다."
    },
    "finance-clarify": {
      "meaning": "구체적인 불확실성이나 모호함을 해소하여 말이나 합의 내용, 질문을 더 분명하게 만드는 것입니다.",
      "usage": "불명확한 표현이나 책임 때문에 합의된 절차를 이해하기 어려울 때 씁니다."
    },
    "finance-rationale": {
      "meaning": "제안이나 결정, 접근법을 제시하는 이유를 설명하는 논리적 근거입니다.",
      "usage": "의사소통 개선 권고를 관찰된 증거와 원하는 결과에 연결할 때 씁니다."
    },
    "finance-recommend": {
      "meaning": "상황에 비추어 더 나은 이유를 설명하며 특정 행동 방안을 제안하는 것입니다.",
      "usage": "적절한 결정권자가 검토할 수 있도록 구체적인 의사소통 개선안을 제시할 때 씁니다."
    },
    "finance-constructive": {
      "meaning": "비난에 그치지 않고 구체적이고 실행 가능한 방식으로 상황의 이해나 개선에 도움이 되는 태도입니다.",
      "usage": "의사소통 문제 제기를 실질적인 요청이나 확인, 승인된 절차 개선으로 이어 갈 때 씁니다."
    },
    "finance-caveat": {
      "meaning": "진술이나 제안한 방안을 이해할 때 고려해야 할 구체적인 제한이나 조건입니다.",
      "usage": "유용한 보고 내용이 과장되지 않도록 정확한 단서를 덧붙여 동료에게 설명할 때 씁니다."
    },
    "finance-perspective": {
      "meaning": "개인이 가진 정보와 처한 상황에 따라 어떤 일을 이해하거나 경험하는 관점입니다.",
      "usage": "우리 팀의 시각만 옳다고 가정하지 않고 상대의 의사소통 경험을 이해할 때 씁니다."
    },
    "finance-explicit": {
      "meaning": "듣거나 읽는 사람이 추측하도록 두지 않고 직접적이고 분명하게 표현된 상태입니다.",
      "usage": "인수인계나 회의 결과에서 중요한 전달 업무가 암묵적으로 남지 않게 할 때 씁니다."
    },
    "finance-reconcile": {
      "meaning": "서로 다른 설명이나 기록을 비교하고 그 차이에 대해 증거가 뒷받침하는 설명을 찾는 것입니다.",
      "usage": "여러 의사소통 기록의 중요한 차이를 없애지 않으면서 대조할 때 씁니다."
    },
    "project-scope": {
      "meaning": "역할이나 업무, 논의에 포함되는 활동과 책임 또는 질문의 정해진 범위입니다.",
      "usage": "내가 도울 수 있는 부분과 다른 권한 있는 담당자가 필요한 부분을 구분할 때 씁니다."
    },
    "project-dependency": {
      "meaning": "계획된 활동의 의사소통 준비를 확인하거나 완료하기 위해 먼저 필요한 사항입니다.",
      "usage": "서비스 조정에서 한 팀의 업무가 다른 팀의 특정 확인이나 자료에 달려 있을 때 씁니다."
    },
    "people-psychological-safety": {
      "meaning": "선의로 질문이나 우려, 실수를 말해도 대인관계에서 모욕이나 처벌을 받지 않을 것이라는 팀의 공통된 인식입니다.",
      "usage": "직급에 관계없이 의사소통 우려를 제기할 수 있는 팀 환경을 논의할 때 씁니다."
    },
    "people-equitable": {
      "meaning": "모두에게 똑같이 제공하기보다 서로 다른 필요와 장벽을 고려하여 공정한 상태입니다.",
      "usage": "하나의 정보 형식을 모두에게 적용하지 않고 개인에게 맞는 지원이 필요한 이유를 설명할 때 씁니다."
    },
    "consulting-synthesise": {
      "meaning": "여러 출처의 관련 정보를 중요한 차이와 한계를 유지하면서 일관된 설명으로 종합하는 것입니다.",
      "usage": "회의에서 흩어진 관찰을 나열하는 대신 공통된 핵심 내용을 정리할 때 씁니다."
    },
    "consulting-actionable": {
      "meaning": "적절한 담당자나 팀이 명확한 다음 조치를 취할 만큼 구체적인 상태입니다.",
      "usage": "막연한 의사소통 피드백을 누군가 실행할 수 있는 범위가 분명한 요청으로 바꿀 때 씁니다."
    },
    "consulting-triangulate": {
      "meaning": "여러 관련 출처나 방법으로 같은 질문을 살펴 일치하는 근거와 차이, 남은 불확실성을 비교하는 것입니다.",
      "usage": "하나의 사례나 기록보다 넓은 증거를 바탕으로 의사소통 개선을 검토할 때 씁니다."
    },
    "operations-capacity": {
      "meaning": "명시한 인력과 시간, 자원 조건 아래에서 의료 서비스가 수행할 수 있는 의사소통 또는 행정 업무량입니다.",
      "usage": "서비스 업무량과 가능한 지원, 책임자의 검토가 필요한 약속을 설명할 때 쓰며 환자의 의사결정 능력이라는 뜻은 아닙니다."
    },
    "operations-contingency": {
      "meaning": "특정 준비나 약속이 예상대로 진행되지 않을 경우를 대비해 마련한 대체 대응책입니다.",
      "usage": "적용 조건과 적절한 책임 팀을 명시하여 대체 지원 방안을 논의할 때 씁니다."
    },
    "healthcare-triage": {
      "meaning": "사례를 평가해 대응 순서나 경로를 정하는 분류이며, 여기서는 권한 있는 팀의 기록된 결정을 알아보는 용어입니다.",
      "usage": "기록된 분류 상태를 이해하거나 전달하는 데만 쓰며 긴급도나 다음 임상 조치를 스스로 결정하지 않습니다."
    },
    "healthcare-prognosis": {
      "meaning": "질환의 예상 경과나 결과에 대한 평가인 예후를 뜻하며, 여기서는 그 용어를 알아보는 데 한정합니다.",
      "usage": "기록에 나온 예후에 관한 질문을 확인하고 해당 진료를 담당하는 자격을 갖춘 의료진의 설명으로 연결할 때 씁니다."
    },
    "healthcare-contraindication": {
      "meaning": "특정 치료나 처치를 부적절하게 만들 수 있는 상태나 요인인 금기를 뜻하며, 그 의미의 판단은 해당 자격을 갖춘 전문가가 맡습니다.",
      "usage": "기록 속 용어에 관한 질문을 적절한 전문가에게 전달할 때 쓰며 치료의 적합성을 직접 해석하지 않습니다."
    },
    "healthcare-adherence": {
      "meaning": "당사자가 합의된 치료나 돌봄 계획을 얼마나 일관되게 따르는지를 뜻합니다.",
      "usage": "합의된 계획을 따르고 있는지와 이를 뒷받침할 지원을 논의할 때 씁니다."
    },
    "healthcare-escalation": {
      "meaning": "문제를 다룰 적절한 권한이나 전문성, 자원을 가진 담당자 또는 단계에 알리는 것입니다.",
      "usage": "해결되지 않은 의사소통 문제에 현재 역할이나 연락 경로를 넘어선 지원이 필요할 때 씁니다."
    },
    "healthcare-informed-consent": {
      "meaning": "관련 정보를 제공받고 이해한 사람이 전문적 요건에 따라 자발적으로 선택하는 의사결정 과정인 충분한 설명에 근거한 동의입니다.",
      "usage": "서명만을 동의 과정 전체로 여기지 않고 결정에 필요한 의사소통 과정을 이해할 때 씁니다."
    },
    "healthcare-continuity-of-care": {
      "meaning": "정보와 책임을 조정하여 담당자나 팀, 시간이 바뀌어도 돌봄이 일관되고 연결되게 이어지는 것입니다.",
      "usage": "전문가나 서비스가 바뀔 때 관련 정보와 확실한 후속 조치가 중요한 이유를 설명할 때 씁니다."
    },
    "healthcare-differential-diagnosis": {
      "meaning": "의료진이 증상이나 징후를 설명할 수 있는 여러 질환을 체계적으로 검토하는 감별진단으로, 이 항목은 용어 인지만 다룹니다.",
      "usage": "기존 기록의 표현을 알아보고 전문적인 설명을 요청할 때 쓰며 가능한 진단을 생성하거나 평가하지 않습니다."
    },
    "project-product-feasibility": {
      "meaning": "가용 자원과 준비 상태, 관련 요건을 고려할 때 제안을 현실적으로 실행할 수 있는 정도입니다.",
      "usage": "의사소통 아이디어에 필요한 인력과 번역, 정보 형식, 배포, 지원을 점검할 때 씁니다."
    },
    "sales-business-development-follow-up": {
      "meaning": "진행 상황을 확인하거나 미해결 질문에 답하고 합의된 전달 업무를 마치기 위한 후속 연락이나 조치입니다.",
      "usage": "대화를 마치며 구체적인 다음 행동과 담당자를 정할 때 씁니다."
    },
    "sales-business-development-acknowledge": {
      "meaning": "상대의 말이나 우려, 경험을 알아듣고 반응하되 모든 결론에 동의한다는 뜻은 아닙니다.",
      "usage": "어려운 서비스 대화를 시작하며 상대의 우려를 들었음을 보여 줄 때 씁니다."
    },
    "sales-business-development-stewardship": {
      "meaning": "개인이나 팀에 맡겨진 자원과 정보, 절차를 오랜 기간 책임감 있게 돌보고 관리하는 것입니다.",
      "usage": "의사소통 자료를 처음 내놓는 것뿐 아니라 계속 정확하고 적절하게 유지할 책임을 논의할 때 씁니다."
    },
    "operations-supply-chain-governance": {
      "meaning": "조직이 결정을 이끌고 권한을 배분하며 성과와 우려 사항을 검토하는 구조와 절차입니다.",
      "usage": "개별 업무를 넘어 의사소통 절차가 어떻게 통제되고 검토되는지 설명할 때 씁니다."
    },
    "operations-supply-chain-sustainability": {
      "meaning": "어떤 접근법이 평상시 근무 여건에서도 오랫동안 유용하게 유지되고 지원될 수 있는 정도입니다.",
      "usage": "시범 운영이나 임시 팀이 끝난 뒤에도 의사소통 개선을 이어 갈 방안을 계획할 때 씁니다."
    },
    "people-human-resources-inference": {
      "meaning": "출처에 직접 명시되거나 별도로 확인된 사실이 아니라 정보를 바탕으로 이끌어 낸 추론입니다.",
      "usage": "환자가 기록상 실제로 한 말과 상호작용에 대한 해석을 구분할 때 씁니다."
    },
    "people-human-resources-uncertainty": {
      "meaning": "특정 사실이나 준비 상태, 결론에 관해 충분한 정보나 확신이 부족함을 인정한 상태입니다.",
      "usage": "근거 없는 안심으로 메우지 않고 구체적으로 무엇이 확인되지 않았는지 밝힐 때 씁니다."
    },
    "people-human-resources-de-escalate": {
      "meaning": "침착하고 존중하는 의사소통과 적절한 지원으로 상호작용의 긴장이나 혼란을 줄이는 것입니다.",
      "usage": "긴장된 서비스 대화를 차분하고 이해하기 쉽게 만들려는 노력을 설명할 때 씁니다."
    },
    "people-human-resources-candour": {
      "meaning": "문제나 실수를 포함한 관련 사실을 숨기거나 오해를 주는 안심으로 덮지 않고 솔직하게 인정하는 태도입니다.",
      "usage": "알려진 의사소통 문제에 정직하게 대응하는 방식을 논의할 때 씁니다."
    },
    "people-human-resources-boundary": {
      "meaning": "역할이나 상호작용에 적절히 포함되는 일과 다른 권한 또는 전문성이 필요한 일을 구분하는 명확한 한계입니다.",
      "usage": "도움을 주는 의사소통 역할을 유지하되 역량 밖의 임상 결정이나 설명을 맡지 않을 때 씁니다."
    },
    "people-human-resources-inclusion": {
      "meaning": "참여를 가로막는 장벽을 고려하여 사람들이 상호작용이나 절차에 의미 있게 참여하도록 하는 것입니다.",
      "usage": "누가 의사소통에 참여할 수 있고 준비된 방식이 그 목소리를 반영하는지 점검할 때 씁니다."
    },
    "healthcare-summarise": {
      "meaning": "긴 설명의 의미와 중요한 단서를 유지하면서 핵심 내용을 간추려 말하는 것입니다.",
      "usage": "회의나 인수인계에서 미해결 의사소통 업무를 논의하기 전에 전체 맥락을 짚어 줄 때 씁니다."
    },
    "healthcare-pending": {
      "meaning": "현재 보고 시점에 아직 완료되거나 해결, 확인되지 않은 상태입니다.",
      "usage": "인수인계나 서비스 보고에서 남은 의사소통 업무와 끝난 일을 구분할 때 씁니다."
    },
    "healthcare-acknowledgement": {
      "meaning": "메시지나 요청, 정보를 받았거나 인지했음을 분명히 나타내는 응답입니다.",
      "usage": "메시지를 보냈다는 사실만으로 수신자가 확인했는지 알 수 없을 때 씁니다."
    },
    "healthcare-check-back": {
      "meaning": "받는 사람이 핵심 정보를 되말하고 보낸 사람이 그 이해가 맞는지 확인하거나 바로잡는 교환입니다.",
      "usage": "들었다고 해서 이해했다고 가정하지 않고 팀원 사이의 특정 메시지를 확인할 때 씁니다."
    },
    "healthcare-named-contact": {
      "meaning": "정해진 의사소통이나 조정 사안에 대해 연락할 수 있도록 구체적으로 지정한 담당자 또는 역할입니다.",
      "usage": "환자나 동료가 질문이나 미해결 업무를 누구에게 문의해야 할지 분명히 알도록 할 때 씁니다."
    },
    "healthcare-concern": {
      "meaning": "불확실성이나 걱정을 일으켜 주의와 확인 또는 적절한 검토가 필요한 구체적인 사안입니다.",
      "usage": "근거 없는 원인 설명을 사실처럼 제시하지 않고 관찰한 의사소통 문제를 말할 때 씁니다."
    },
    "healthcare-local-protocol": {
      "meaning": "정해진 활동의 책임과 연락 경로, 필요한 조치를 포함하여 해당 기관이 승인한 절차입니다.",
      "usage": "가상 학습 상황 대신 실제 근무지에서 적용되는 승인된 절차를 확인하도록 안내할 때 씁니다."
    },
    "healthcare-accessible": {
      "meaning": "개인의 정보 및 의사소통 필요를 고려했을 때 이해하고 이용할 수 있는 상태입니다.",
      "usage": "정보가 특정 환자나 돌봄 제공자에게 어떻게 전달되고 이해되는지 논의할 때 씁니다."
    },
    "healthcare-interpreter": {
      "meaning": "대화 중 음성 언어나 수어 사이에서 의미를 전달하는 통역사입니다.",
      "usage": "환자가 대화에 참여할 수 있도록 적절한 언어 지원을 마련할 때 씁니다."
    },
    "healthcare-plain-language": {
      "meaning": "대상자가 정보를 찾고 이해하며 활용할 수 있도록 익숙하고 명확한 말로 구성한 표현입니다.",
      "usage": "전문 용어가 환자나 돌봄 제공자, 다른 분야 동료의 이해를 막을 수 있을 때 씁니다."
    },
    "healthcare-verified": {
      "meaning": "적절한 출처나 절차에 따라 확인했으며 그 확인 범위 안에서 사실로 뒷받침된 상태입니다.",
      "usage": "전달 내용 중 어떤 부분이 기억에만 의존하지 않고 근거로 확인되었는지 밝힐 때 씁니다."
    },
    "healthcare-source": {
      "meaning": "승인된 기록이나 정보를 제공한 사람처럼 정보가 어디서 왔는지 식별할 수 있는 출처입니다.",
      "usage": "문서화된 내용과 누군가의 전달, 자신의 기억을 구분해야 할 때 씁니다."
    },
    "healthcare-chronology": {
      "meaning": "관련 날짜나 시간에 따라 사건이나 의사소통 조치를 순서대로 정리한 경과입니다.",
      "usage": "의사소통 실패를 검토하며 일어난 순서와 책임 또는 원인에 대한 추정을 구분할 때 씁니다."
    },
    "healthcare-objective": {
      "meaning": "사람의 성격이나 의도에 대한 개인적 판단이 아니라 관찰하거나 확인할 수 있는 정보에 근거한 상태입니다.",
      "usage": "평가적인 꼬리표 없이 동료에게 상호작용의 정확한 맥락을 전달할 때 씁니다."
    },
    "healthcare-ambiguous": {
      "meaning": "뜻이나 지칭 대상, 책임이 충분히 분명하지 않아 둘 이상으로 해석될 수 있는 상태입니다.",
      "usage": "환자나 동료가 서로 다르게 이해할 수 있는 문구를 검토할 때 씁니다."
    },
    "healthcare-omission": {
      "meaning": "설명이나 기록, 의사소통에서 관련 있는 내용이 빠진 누락입니다.",
      "usage": "빠진 세부 정보 때문에 합의된 전달 과정을 온전히 이해하기 어려울 때 씁니다."
    },
    "healthcare-succinct": {
      "meaning": "메시지를 정확히 이해하는 데 필요한 정보는 담으면서 짧게 표현한 상태입니다.",
      "usage": "긴 논의나 복잡한 기록 검토 뒤 명료한 의사소통 결론을 전달할 때 씁니다."
    },
    "healthcare-pertinent": {
      "meaning": "현재 다루는 특정 질문이나 결정, 의사소통 목적에 직접 관련되는 상태입니다.",
      "usage": "전체 이력 대신 당장의 전달 업무에 필요한 세부 사항을 고를 때 씁니다."
    },
    "healthcare-teach-back": {
      "meaning": "상대가 정보를 자기 말로 설명하도록 요청하여 설명이 얼마나 명확했는지 확인하는 의사소통 방법입니다.",
      "usage": "설명 후 상대를 시험하거나 부끄럽게 하지 않는 방식으로 오해를 확인할 때 씁니다."
    },
    "healthcare-paraphrase": {
      "meaning": "원래 의미를 유지하면서 다른 말로 다시 표현하는 것입니다.",
      "usage": "이해한 내용을 확인하거나 환자의 요청을 정확히 되짚은 뒤 추가 설명을 구할 때 씁니다."
    },
    "healthcare-comprehension": {
      "meaning": "정보를 듣거나 받거나 그대로 반복하는 것에 그치지 않고 그 의미를 이해하는 것입니다.",
      "usage": "설명이 이해되었는지와 어떤 의사소통 지원이 도움이 될지 논의할 때 씁니다."
    },
    "healthcare-qualification": {
      "meaning": "진술의 의미나 증거가 뒷받침하는 범위를 더 정확하게 하려고 덧붙이는 조건이나 한정입니다.",
      "usage": "동료가 광범위한 주장에 의존하기 전에 정확한 제한을 덧붙일 때 쓰며 자격증이라는 뜻은 아닙니다."
    },
    "healthcare-limitation": {
      "meaning": "사람이나 기록, 설명 또는 증거가 제공하거나 입증할 수 있는 범위의 구체적인 한계입니다.",
      "usage": "자신이 아는 것과 할 수 있는 일을 솔직히 밝히면서 적절한 지원으로 안내할 때 씁니다."
    },
    "healthcare-preference": {
      "meaning": "어떤 준비나 경험 방식을 원하는지 개인이 표현한 선택이나 선호입니다.",
      "usage": "당사자가 의사소통이나 지원 방식에 관해 실제로 요청한 내용을 전달할 때 씁니다."
    },
    "healthcare-priorities": {
      "meaning": "현재 논의나 상황에서 개인 또는 팀이 가장 중요하게 여기는 사항들입니다.",
      "usage": "회의가 팀의 행정 안건뿐 아니라 당사자가 밝힌 관심사를 반영하도록 할 때 씁니다."
    },
    "healthcare-deliberation": {
      "meaning": "결정을 내리기 전에 정보와 질문, 여러 선택지를 신중하게 검토하는 숙고입니다.",
      "usage": "당사자가 성급히 답하도록 재촉받지 않고 정보를 생각할 시간을 어떻게 마련할지 논의할 때 씁니다."
    },
    "healthcare-availability": {
      "meaning": "특정 사람이나 서비스, 자원을 필요한 목적과 일정에 실제로 이용할 수 있는지 여부입니다.",
      "usage": "지원 요청을 했다는 것과 필요한 일정에 제공이 확정됐다는 것을 구분할 때 씁니다."
    },
    "healthcare-respectful": {
      "meaning": "의견이 다르더라도 상대의 존엄과 관점, 정당한 역할을 배려하는 태도입니다.",
      "usage": "당사자의 존엄과 협업 관계를 지키면서 동료에게 의사소통 개선을 요청할 때 씁니다."
    },
    "healthcare-assertive": {
      "meaning": "다른 사람의 권리와 관점을 존중하면서 자신의 입장이나 우려를 직접적이고 자신 있게 밝히는 태도입니다.",
      "usage": "간접적인 암시로 책임이 불분명해져 명확한 요청이 필요할 때 씁니다."
    },
    "healthcare-non-judgemental": {
      "meaning": "근거 없이 비난하거나 동기나 성격에 부정적 꼬리표를 붙이지 않고 의사소통을 살펴보는 태도입니다.",
      "usage": "상호작용이나 장벽을 기록하며 편견 섞인 평가 대신 유용한 사실을 전달할 때 씁니다."
    },
    "healthcare-speak-up": {
      "meaning": "특히 집단이나 위계 속에서 말하지 못하고 지나칠 수 있는 질문이나 우려를 드러내어 말하는 것입니다.",
      "usage": "해결되지 않은 의사소통의 공백을 동료가 알릴 수 있도록 독려할 때 씁니다."
    },
    "healthcare-voluntary": {
      "meaning": "다른 사람의 부당한 압력이나 위협, 강요 때문이 아니라 스스로 자유롭게 선택한 상태입니다.",
      "usage": "당사자가 질문하고 자신의 입장을 표현할 자유를 존중하는 문구를 논의할 때 씁니다."
    },
    "healthcare-coercion": {
      "meaning": "압력이나 물리력, 위협으로 개인이 자유롭게 선택할 수 있는 여지를 훼손하는 강요입니다.",
      "usage": "의사소통이 충분한 이해를 돕기보다 상대를 압박할 소지가 있는지 신중히 검토할 때 씁니다."
    },
    "healthcare-confidentiality": {
      "meaning": "정보를 받을 적절한 권한이 없는 사람이나 경로에 정보가 공개되지 않도록 보호하는 비밀 유지입니다.",
      "usage": "인수인계나 문의, 업무 조정 중 환자 정보를 적절하게 다루는 방식을 논의할 때 씁니다."
    },
    "healthcare-discretion": {
      "meaning": "민감한 대화에서 무엇을 어디서 말하고 누가 들어야 하는지 신중하게 판단하는 태도입니다.",
      "usage": "다른 사람이 들을 필요 없는 정보를 사생활을 존중하는 장소와 방식으로 전달할 때 씁니다."
    },
    "healthcare-authorised-recipient": {
      "meaning": "기관의 해당 절차에 따라 정당한 목적으로 특정 정보를 받을 권한이 있는 사람이나 역할입니다.",
      "usage": "누가 환자 관련 정보를 받을 수 있으며 왜 필요한지 확인할 때 씁니다."
    },
    "healthcare-coordination": {
      "meaning": "관련된 사람이나 팀의 행동이 서로 맞물리고 책임이 분명해지도록 조정하는 것입니다.",
      "usage": "여러 담당자가 맡은 전달 업무 사이에 공백이 생기지 않도록 역할을 맞출 때 씁니다."
    },
    "healthcare-closed-loop-communication": {
      "meaning": "메시지가 의도한 수신자에게 전달되었고 그 뜻이 맞게 이해되었는지 확인까지 마치는 의사소통입니다.",
      "usage": "중요한 인수인계에서 보내는 것만으로 끝났다고 가정하지 않고 이해를 확인할 때 씁니다."
    },
    "healthcare-referral": {
      "meaning": "당사자의 관련 필요를 다른 전문가나 서비스가 검토하도록 승인된 경로로 보내는 의뢰입니다.",
      "usage": "적절한 절차로 이미 승인된 의뢰의 전달과 진행 확인을 논의할 때 씁니다."
    },
    "healthcare-accommodation": {
      "meaning": "개인의 의사소통이나 참여에 필요한 요구를 충족하도록 준비나 방식을 조정하는 것입니다.",
      "usage": "확인된 전달 장벽을 줄일 수 있는 구체적인 실무 조정을 논의할 때 씁니다."
    },
    "healthcare-readiness": {
      "meaning": "계획한 활동에 필요한 확인과 자원, 합의, 준비가 갖춰진 상태입니다.",
      "usage": "의사소통 개선안이 초안을 넘어서 정해진 다음 단계로 갈 준비가 됐는지 점검할 때 씁니다."
    },
    "healthcare-implementation": {
      "meaning": "승인된 접근법을 책임 배분과 준비, 후속 조치를 포함해 실제 사용으로 옮기는 도입 과정입니다.",
      "usage": "합의된 의사소통 개선안을 초안에서 통제된 실제 사용으로 전환하는 방식을 설명할 때 씁니다."
    },
    "healthcare-standardisation": {
      "meaning": "특정 목적에 도움이 되도록 합의된 정의나 형식, 방식을 일관되게 정하는 표준화입니다.",
      "usage": "서로 다른 의사소통 관행이 불필요한 모호함이나 인수인계의 어려움을 만들 때 씁니다."
    },
    "healthcare-audit-trail": {
      "meaning": "관련 행동과 변경, 승인, 시점을 나중에 추적하여 검토할 수 있도록 남긴 기록입니다.",
      "usage": "승인된 의사소통 자료가 어떻게 바뀌었고 어떤 버전이 쓰였는지 확인해야 할 때 씁니다."
    },
    "healthcare-feedback": {
      "meaning": "상호작용이나 절차가 어떻게 경험되거나 수행되었는지 알려 주어 성찰과 개선에 활용하는 정보입니다.",
      "usage": "의사소통 검토에 당사자의 경험을 반영하거나 설명이 도움이 됐는지 물을 때 씁니다."
    },
    "healthcare-learning-culture": {
      "meaning": "적절한 전문적 책임을 유지하면서 경험에 대한 질문과 성찰, 개선을 뒷받침하는 업무 문화입니다.",
      "usage": "자동으로 개인을 탓하거나 환자의 경험을 무시하지 않고 의사소통 과정을 솔직히 검토할 때 씁니다."
    },
    "healthcare-reflective-practice": {
      "meaning": "자신의 행동과 경험을 체계적으로 돌아보며 이해하고 앞으로의 전문적 실무를 개선하는 성찰적 실천입니다.",
      "usage": "자신의 의사소통 선택을 열린 태도로 살펴 개선할 방법을 찾을 때 씁니다."
    },
    "healthcare-transparency": {
      "meaning": "무엇을 알고 어떤 조치를 하는지 이해할 수 있도록 관련 정보와 근거, 한계, 행동을 공개적으로 설명하는 투명성입니다.",
      "usage": "의사소통 문제와 그 대응에 관해 명확한 설명이 필요할 때 씁니다."
    },
    "healthcare-empathy": {
      "meaning": "상대의 마음을 정확히 안다고 단정하지 않으면서 감정과 경험을 이해하고 인정하려는 공감입니다.",
      "usage": "혼란이나 답답함, 걱정에 대해 진솔하고 구체적으로 반응할 때 씁니다."
    },
    "healthcare-shared-understanding": {
      "meaning": "관련 정보와 책임, 다음 단계에 대해 참여자들이 충분히 공통된 이해를 갖는 상태입니다.",
      "usage": "대화의 실질적인 내용과 각자 맡은 역할을 같은 뜻으로 이해했는지 확인할 때 씁니다."
    }
  }
};
