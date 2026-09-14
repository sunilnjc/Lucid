import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async name => readFile(new URL(`../ios/Lucid/Lucid/${name}.swift`, import.meta.url), "utf8");

// Source contracts complement, but do not replace, simulator/VoiceOver interaction.
test("setup has an exit, a reachable action, and explicit selection guidance", async () => {
  const root = await source("RootView");
  assert.match(root, /onBack: store.openHome/);
  assert.match(root, /safeAreaInset\(edge: \.bottom\)/);
  assert.match(root, /Choose at least one daily situation and one communication goal/);
  assert.match(root, /accessibilityIdentifier\("onboarding.continue"\)/);
});

test("daily-practice navigation both selects Today and resets its navigation stack", async () => {
  assert.match(await source("LearningStore"), /func openToday\(\) \{\s*todayNavigationReset = UUID\(\)\s*selectedTab = 0/);
  assert.match(await source("RootView"), /\.id\(store.todayNavigationReset\)/);
  assert.match(await source("LearningPathViews"), /Button\(action: store.openToday\)/);
  assert.match(await source("SecondaryViews"), /Button\(action: store.openToday\)/);
});

test("role editing explains immediate changes and opens Today only after saving", async () => {
  const root = await source("RootView");
  assert.match(root, /Change your role to update Today’s words now/);
  assert.match(root, /Save and open Today/);
  assert.match(root, /if saved && editing \{ dismiss\(\); store.openToday\(\) \}/);
  assert.match(root, /selectNextUnfinishedWord\(\)/);
  assert.doesNotMatch(root, /Saves your profile without changing today’s lesson/);
  assert.match(await source("LearningPathViews"), /A chapter-by-chapter course is not available for this role yet/);
  assert.match(await source("SecondaryViews"), /Words from other roles stay saved under All roles/);
});

test("new-role practice is distinct from the already-earned daily bonus", async () => {
  const root = await source("RootView");
  const dashboard = await source("ExperienceViews");
  assert.match(root, /if store.isTodayComplete \{\s*Label\(store.isCurrentPlanComplete/);
  assert.match(root, /Daily bonus earned · Continue with the words above/);
  assert.match(dashboard, /Text\(store.isCurrentPlanComplete \?/);
  assert.match(dashboard, /10 XP per new word · Daily bonus already earned/);
});

test("Home is visible on every main tab and Welcome always opens Today", async () => {
  const app = await source("LucidApp");
  const root = await source("RootView");
  assert.match(app, /Button\(action: store.openHome\)/);
  assert.match(app, /Image\(systemName: "house"\)/);
  assert.match(app, /Text\("Home"\)/);
  assert.match(app, /accessibilityIdentifier\("navigation.home"\)/);
  for (const [name, titles] of [["RootView", ["Today"]], ["SecondaryViews", ["Review", "Library", "Progress"]], ["SettingsView", ["Settings"]]]) {
    const view = await source(name);
    for (const title of titles) assert.match(view, new RegExp(`navigationTitle\\("${title}"\\)\\s*\\.lucidHomeNavigation\\(\\)`));
  }
  assert.match(root, /WelcomeView[\s\S]*?withAnimation[\s\S]*?store.openToday\(\)/);
});

test("Review uses current-role scope, one card, matching counts, and an explicit save step", async () => {
  const review = await source("SecondaryViews");
  assert.match(review, /private var reviews: \[ProfessionalWord\] \{ store.visibleReviewWords \}/);
  assert.match(review, /selection: \$store.reviewIncludesOtherRoles/);
  assert.match(review, /else if let word = reviews.first/);
  assert.match(review, /Revealing the answer alone does not finish the review/);
  assert.match(review, /proxy.scrollTo\(reviews.isEmpty \|\| store.hasUnsavedChanges/);
  assert.match(review, /if store.hasUnsavedChanges[\s\S]*?Waiting to save your review/);
  assert.match(await source("RootView"), /badge\(store.visibleReviewWords.count\)/);
  assert.match(await source("ExperienceViews"), /store.currentRoleDueWords.count/);
});

test("review explains its irreversible recall gate and recording blocks completion", async () => {
  const review = await source("SecondaryViews");
  const root = await source("RootView");
  assert.match(review, /workplace sentence of at least five words before you reveal/);
  assert.match(review, /\.disabled\(answerWordCount < 5\)/);
  assert.match(root, /\.disabled\(completed \|\| coach.isListening \|\| coach.requestingAccess/);
  assert.match(root, /\.disabled\(coach.isListening \|\| coach.requestingAccess/);
  assert.match(root, /Cancel microphone request/);
});

test("email availability and recovery states do not advertise a working signup flow", async () => {
  const root = await source("RootView");
  const settings = await source("SettingsView");
  const account = await source("AccountView");
  assert.match(root, /store.session == nil && store.accountService\?\.emailDeliveryReady == true/);
  assert.match(settings, /if store.accountService\?\.emailDeliveryReady == true/);
  assert.match(account, /if store.accountService\?\.emailDeliveryReady != true/);
  for (const view of [root, settings]) assert.match(view, /store.needsAccountVerification/);
});

test("new-account welcome has identity and an exit before onboarding", async () => {
  const root = await source("RootView");
  const account = await source("AccountView");
  assert.match(root, /if !hasProfile, let session = store.session/);
  assert.match(root, /Signed in as/);
  assert.match(root, /welcome.signOut/);
  assert.match(root, /Sign out or use a different email/);
  assert.match(account, /Retain the resend cooldown, not the code\.[\s\S]*?code = ""/);
});

test("writing screens expose keyboard dismissal and accessibility scales with content", async () => {
  for (const name of ["RootView", "SecondaryViews", "LearningPathViews", "SettingsView", "AccountView"]) {
    assert.match(await source(name), /lucidKeyboardDismissal\(\)/, name);
  }
  const app = await source("LucidApp");
  assert.match(app, /ToolbarItemGroup\(placement: \.keyboard\)/);
  assert.match(app, /accessibilityLabel\("Dismiss keyboard"\)/);
  assert.match(await source("RootView"), /dynamicTypeSize.isAccessibilitySize \? 1/);
  assert.match(await source("SettingsView"), /accessibilityLabel\("Audio speed"\)/);
  assert.match(await source("LearningStore"), /search.trimmingCharacters\(in: \.whitespacesAndNewlines\)/);
});

test("Library uses store-scoped filters and resets without silently widening to other roles", async () => {
  const view = await source("SecondaryViews");
  assert.match(view, /private var words: \[ProfessionalWord\] \{ store.visibleLibraryWords \}/);
  assert.match(view, /selection: \$store.libraryIncludesOtherRoles/);
  assert.match(view, /searchable\(text: \$store.librarySearch/);
  assert.match(view, /Button\("Reset to my role", action: store.resetLibraryFilters\)/);
  assert.match(view, /\.id\(store.libraryNavigationReset\)/);
  assert.match(view, /Your role’s full collection, not just today’s words/);
  assert.doesNotMatch(view, /Clear filters and show all words|@State private var selectedScope/);
  assert.match(await source("RootView"), /Button\("Open my word library", action: store.openLibrary\)/);
});

test("feedback prevents duplicate success and accidental dismissal during submission", async () => {
  const settings = await source("SettingsView");
  assert.match(settings, /Your feedback \(required\)/);
  assert.match(settings, /submitted = await store.submitBetaFeedback/);
  assert.match(settings, /\.disabled\(submitted \|\| store.isSendingFeedback/);
  assert.match(settings, /interactiveDismissDisabled\(store.isSendingFeedback\)/);
  assert.match(settings, /onAppear \{ store.feedbackStatus = nil \}/);
});
