/** Landing-page localization is separate from learning content and account identity. */
export const PUBLIC_LUCID_ORIGIN = "https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site";
export const landingLocaleRegistry = [
  { locale: "en", label: "English", status: "available" },
  { locale: "ko", label: "한국어", status: "available" },
  { locale: "ja", label: "日本語", status: "planned" },
  { locale: "zh-CN", label: "简体中文", status: "planned" },
  { locale: "zh-TW", label: "繁體中文", status: "planned" },
] as const;
export type LandingLocale = "en" | "ko";
export type PlannedLandingLocale = typeof landingLocaleRegistry[number]["locale"];
export function resolveLandingLocale(requested?: string): LandingLocale {
  return requested?.toLowerCase() === "ko" ? "ko" : "en";
}
export const availableLandingLocales = landingLocaleRegistry.filter((entry) => entry.status === "available");
export const landingLanguageAlternates = { en: `${PUBLIC_LUCID_ORIGIN}/en`, ko: `${PUBLIC_LUCID_ORIGIN}/ko`, "x-default": `${PUBLIC_LUCID_ORIGIN}/en` };
export type LandingCopy = {
  title: string; description: string; languageLabel: string; skip: string;
  navDemo: string; navHow: string; navStart: string; eyebrow: string;
  heading: string; headingAccent: string; introduction: string; cta: string; ctaNote: string; coverage: string;
  dailyLabel: string; dailyValue: string; rolesLabel: string; rolesValue: string; practiceLabel: string; practiceValue: string;
  demoEyebrow: string; demoHeading: string; demoIntro: string; demoSituation: string; demoSituationLabel: string;
  demoLabels: { plain: string; precise: string; diplomatic: string }; demoNotes: { plain: string; precise: string; diplomatic: string }; demoFootnote: string;
  howEyebrow: string; howHeading: string; steps: readonly { title: string; body: string }[];
  rolesEyebrow: string; rolesHeading: string; rolesIntro: string; roles: readonly string[];
  careEyebrow: string; careHeading: string; careBody: string; careNote: string;
  faqHeading: string; faq: readonly { question: string; answer: string }[];
  finalHeading: string; finalBody: string; footerTagline: string; privacy: string; support: string; openApp: string;
};
const english: LandingCopy = {
  title: "Lucid — Turn the English you know into words you can use at work",
  description: "Practise professional English for your role. Start free with one to three useful words a day, workplace examples and spaced review. No account required.",
  languageLabel: "Page language", skip: "Skip to content", navDemo: "Try the demo", navHow: "How it works", navStart: "Open Lucid",
  eyebrow: "PROFESSIONAL ENGLISH, IN CONTEXT", heading: "You know the idea.", headingAccent: "Find the words for it.",
  introduction: "Explain your thinking in a meeting. Make an email clearer. Disagree with care. Practise useful English for the moments that matter in your work.",
  cta: "Start free", ctaNote: "No account or payment details needed. Choose one word a day during setup.",
  coverage: "Choose English or Korean in the learning app. Korean support covers navigation, setup, daily words, idioms and Review instructions, with Korean meanings and short usage notes. English words and examples stay visible. Course narratives, Express scenarios, Library/Progress details, account help, detailed settings and policy pages remain in English.",
  dailyLabel: "A manageable daily pace", dailyValue: "1–3 words", rolesLabel: "Built around your work", rolesValue: "8 roles", practiceLabel: "Understand. Use. Revisit.", practiceValue: "Your pace",
  demoEyebrow: "A SMALL TASTE OF EXPRESS", demoHeading: "Same thought. Different tone.",
  demoIntro: "Choose a tone and see how one idea can sound. A more formal word is useful only when it fits the moment.",
  demoSituationLabel: "The situation", demoSituation: "You want to explain why your team chose an approach.",
  demoLabels: { plain: "Plain", precise: "Precise", diplomatic: "Diplomatic" },
  demoNotes: { plain: "Direct, familiar wording works well in an everyday conversation.", precise: "Rationale names the reasoning behind a considered choice.", diplomatic: "A question can make room for discussion before a decision." },
  demoFootnote: "An authored example, not an AI assessment or a learning score.",
  howEyebrow: "A ROUTINE YOU CAN KEEP", howHeading: "A little practice. A useful next step.",
  steps: [
    { title: "Make it relevant", body: "Choose your professional role, the situations you face and what you want to communicate better. Career stage is separate from language ability." },
    { title: "Start small", body: "Choose one, two or three words a day. Try a meaning or sentence choice, get guidance when you need it, and pause without losing your place." },
    { title: "Make it stick", body: "Return for spaced review. In Express, write your response before comparing wording. Guided practice, self-assessment and retained recall stay separate." },
  ],
  rolesEyebrow: "WORDS FOR YOUR WORKING DAY", rolesHeading: "Your context comes first.",
  rolesIntro: "Meetings, updates, decisions and difficult conversations look different in every role. Find examples that belong in yours.",
  roles: ["Finance & Accounting", "Project & Product", "Technology & Engineering", "Sales & Business Development", "HR & People Leadership", "Consulting & Strategy", "Operations & Supply Chain", "Healthcare"],
  careEyebrow: "ROOM TO THINK PRIVATELY", careHeading: "Practise your words. Keep your story yours.",
  careBody: "Your personal situation, original sentences and retries stay on your device during ordinary progress saving. Phrase checks run locally; they do not send your writing to an AI provider or judge its meaning.",
  careNote: "This release starts with guest learning and portable backups. A backup can include private writing, so keep it private. Avoid confidential workplace, customer or patient information.",
  faqHeading: "Before you begin", faq: [
    { question: "Is the starting experience free?", answer: "Yes. You can explore the courses, daily practice and Express without an account or payment details. Choose your role and a small course goal in English or Korean setup." },
    { question: "Can I install Lucid as an app?", answer: "Open Lucid, then choose Install app. Supported browsers may show their installation prompt. On iPhone or iPad, use Safari → Share → Add to Home Screen, keep Open as Web App on if offered, then tap Add. Your browser completes installation." },
    { question: "Can I practise offline?", answer: "Visit the learning app online and wait for offline setup to finish. Its public app shell and courses can then open offline. Guest practice saves for that browser. Feedback and support need internet access." },
    { question: "How do I move my progress?", answer: "Use Settings → Learning backup to export a private backup and explicitly import it on another device. Browser and installed-app storage may differ. Shared-account sign-in is not enabled in this public release; automatic cross-device sync is not available yet." },
    { question: "What is available in Korean?", answer: "Korean support includes navigation, onboarding, daily words and idioms, Review instructions, and meanings with short usage notes for every role-word sense. English terms and examples remain visible. Course narratives, Express scenarios, Library/Progress details, account help, detailed settings, privacy and support remain in English. Japanese and Chinese learning translations are not provided." },
  ],
  finalHeading: "Find your next useful word.", finalBody: "Start with your role. Keep the first step small.",
  footerTagline: "Professional English for your role.", privacy: "Privacy", support: "Support", openApp: "Learning app",
};
const korean: LandingCopy = {
  title: "Lucid — 아는 영어를, 일할 때 쓰는 영어로",
  description: "내 직무에 맞는 영어 표현을 하루 1–3개씩 연습해 보세요. 업무 상황별 예문과 간격을 둔 복습으로 시작하는 무료 학습. 회원가입 없이 시작할 수 있어요.",
  languageLabel: "페이지 언어", skip: "본문으로 바로가기", navDemo: "표현 미리 보기", navHow: "학습 방법", navStart: "Lucid 열기",
  eyebrow: "내 업무에 맞는 영어", heading: "아는 영어를,", headingAccent: "일할 때 쓰는 영어로.",
  introduction: "회의에서 내 생각을 설명하고, 이메일의 뜻을 또렷하게 전하고, 다른 의견도 정중하게 말할 수 있도록. 일하면서 필요한 순간에 맞춰 영어를 연습해 보세요.",
  cta: "무료로 시작하기", ctaNote: "회원가입이나 결제 정보 없이 시작할 수 있어요. 설정에서 하루 한 단어를 선택해 보세요.",
  coverage: "학습 앱에서 한국어 또는 영어를 선택할 수 있어요. 메뉴, 시작 설정, 오늘의 단어·관용 표현과 복습 안내에 한국어를 지원하며, 단어의 뜻과 짧은 사용 설명도 함께 보여 드려요. 영어 단어와 예문은 그대로 유지됩니다. 코스 본문, Express 상황, 보관함·학습 현황의 상세 내용, 계정 도움말, 세부 설정과 정책 페이지는 영어로 제공됩니다.",
  dailyLabel: "부담 없는 하루 학습량", dailyValue: "하루 1–3개", rolesLabel: "내 업무에 맞는 표현", rolesValue: "8개 직무", practiceLabel: "이해하고, 써 보고, 다시 떠올리기", practiceValue: "나만의 속도",
  demoEyebrow: "EXPRESS 미리 보기", demoHeading: "같은 생각도, 어감은 다르게.",
  demoIntro: "톤을 골라 같은 생각을 어떻게 표현할 수 있는지 살펴보세요. 어려운 단어가 언제나 더 좋은 답은 아니에요.",
  demoSituationLabel: "이런 상황이라면", demoSituation: "팀이 이 방식을 선택한 이유를 설명하고 싶어요.",
  demoLabels: { plain: "담백하게", precise: "정확하게", diplomatic: "정중하게" },
  demoNotes: { plain: "일상적인 대화에서는 익숙하고 직접적인 표현이 잘 어울려요.", precise: "Rationale은 충분히 검토한 선택의 근거를 설명할 때 유용해요.", diplomatic: "결정을 내리기 전에 함께 이야기할 여지를 만드는 표현이에요." },
  demoFootnote: "미리 작성된 학습 예시이며, AI 평가나 학습 점수가 아닙니다.",
  howEyebrow: "꾸준히 이어 갈 수 있는 습관", howHeading: "조금씩 연습하고, 필요한 순간에 꺼내 쓰세요.",
  steps: [
    { title: "내 상황부터 고르기", body: "직무, 자주 마주치는 업무 상황, 더 잘 전달하고 싶은 목표를 선택해요. 경력 단계와 영어 실력은 별개로 다룹니다." },
    { title: "작게 시작하기", body: "하루 한 개, 두 개 또는 세 개를 골라요. 뜻이나 문장에 맞는 답을 선택하고, 필요하면 도움을 받아 보세요. 중간에 멈춰도 이어서 할 수 있어요." },
    { title: "다시 떠올려 보기", body: "시간을 두고 복습하고, Express에서는 내 답을 먼저 쓴 뒤 표현을 비교해요. 도움을 받은 연습, 자기 평가, 오래 기억해 낸 결과는 구분해 기록합니다." },
  ],
  rolesEyebrow: "내 업무에 필요한 표현", rolesHeading: "내가 쓰는 상황이 먼저니까.",
  rolesIntro: "같은 영어도 회의, 보고, 의사결정, 어려운 대화에서 쓰임이 달라져요. 내 직무에 어울리는 예문으로 연습해 보세요.",
  roles: ["재무·회계", "프로젝트·프로덕트", "기술·엔지니어링", "영업·사업 개발", "인사·조직 리더십", "컨설팅·전략", "운영·공급망", "헬스케어"],
  careEyebrow: "편하게 생각을 정리할 공간", careHeading: "표현은 연습하고, 내 이야기는 내 곁에.",
  careBody: "일반적인 학습 기록 저장 과정에서는 개인적인 상황, 처음 쓴 문장과 다시 쓴 문장이 이 기기에 남습니다. 표현 확인은 기기에서 이루어지며, 글을 AI 서비스로 보내거나 의미를 평가하지 않습니다.",
  careNote: "이번 공개 버전은 게스트 학습과 학습 백업으로 시작합니다. 백업에는 개인적인 글이 포함될 수 있으니 비공개로 보관해 주세요. 회사, 고객, 환자의 기밀 정보는 입력하지 마세요.",
  faqHeading: "시작하기 전에", faq: [
    { question: "무료로 시작할 수 있나요?", answer: "네. 회원가입이나 결제 정보 없이 코스, 하루 학습, Express를 이용해 볼 수 있어요. 한국어 또는 영어로 시작 설정을 진행하고, 내 직무와 부담 없는 코스 학습량을 선택해 주세요." },
    { question: "앱처럼 설치할 수 있나요?", answer: "Lucid를 열고 Install app을 선택하세요. 지원되는 브라우저에서는 설치 창이 나타날 수 있어요. iPhone과 iPad에서는 Safari의 공유 → 홈 화면에 추가를 사용하고, 웹 앱으로 열기 옵션이 보이면 켠 뒤 추가를 누르세요. 설치는 브라우저에서 완료합니다." },
    { question: "인터넷 없이도 학습할 수 있나요?", answer: "먼저 인터넷에 연결된 상태에서 학습 앱을 열고 오프라인 준비가 끝날 때까지 기다려 주세요. 준비가 끝나면 앱 화면과 코스를 오프라인에서도 열 수 있어요. 게스트 학습은 해당 브라우저에 저장됩니다. 피드백 전송과 지원 페이지에는 인터넷이 필요해요." },
    { question: "다른 기기로 학습 기록을 옮기려면요?", answer: "Settings → Learning backup에서 비공개 백업을 내보낸 뒤 다른 기기에서 직접 가져오세요. 브라우저와 설치된 웹 앱의 저장 공간은 다를 수 있어요. 이번 공개 버전에서는 계정 로그인이 활성화되어 있지 않으며, 기기 간 자동 동기화는 아직 사용할 수 없습니다." },
    { question: "어디까지 한국어로 제공되나요?", answer: "메뉴, 시작 설정, 오늘의 단어·관용 표현과 복습 안내에 한국어를 지원합니다. 모든 직무별 단어 뜻과 짧은 사용 설명도 한국어로 볼 수 있어요. 영어 표현과 예문은 그대로 보여 드립니다. 코스 본문, Express 상황, 보관함·학습 현황의 상세 내용, 계정 도움말, 세부 설정, 개인정보 처리방침과 지원 페이지는 영어로 제공됩니다. 일본어와 중국어 학습 번역은 아직 제공하지 않습니다." },
  ],
  finalHeading: "오늘 쓸 수 있는 표현부터.", finalBody: "내 직무를 고르고, 작은 한 걸음으로 시작해 보세요.",
  footerTagline: "내 직무에 맞는 업무 영어.", privacy: "개인정보 처리방침 (영어)", support: "지원 (영어)", openApp: "학습 앱",
};
export const landingCopies: Record<LandingLocale, LandingCopy> = { en: english, ko: korean };
export function getLandingCopy(requested?: string): LandingCopy { return landingCopies[resolveLandingLocale(requested)]; }
