import VocabularyApp from "./VocabularyApp";

export default function Home() {
  const now = new Date();
  const initialDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    hour12: false,
  }).format(now));
  const initialGreeting = hour < 12
    ? "Good morning."
    : hour < 18
      ? "Good afternoon."
      : "Good evening.";
  return <VocabularyApp initialDate={initialDate} initialGreeting={initialGreeting} />;
}
