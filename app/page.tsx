import VocabularyApp from "./VocabularyApp";

export default function Home() {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const dateValue = (type: string) => dateParts.find((part) => part.type === type)?.value ?? "";
  const initialDate = `${dateValue("year")}-${dateValue("month")}-${dateValue("day")}`;
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
